import { MAX_IMPORT_BYTES, MAX_PAYLOAD_LENGTH, parseJsonData, validateImportedCharacter } from "./dataValidation";
import { decodePDFRawStream, PDFArray, PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFTextField } from "pdf-lib";
import {
  Character,
  FACET_SKILLS,
  GRIEF_CAPACITY,
  INJURY_CAPACITY,
  INJURY_LOCATIONS,
  STRESS_CAPACITY,
  blankCharacter,
  migrateCharacter,
} from "./characters";
import { downloadBlob } from "./characterPng";
import { CHARACTER_PDF_ATTACHMENT_NAME, CHARACTER_PDF_PAYLOAD_FIELD, decodeCharacterPdfPayload } from "./characterPdfPayload";
import { importResourceBundle } from "./resourceBundle";

// Map skill names (with accents) → PDF field base names (no accents)
const SKILL_PDF_NAME: Record<string, string> = {
  // Corps
  Force: "Force",
  Endurance: "Endurance",
  Mobilité: "Mobilite",
  Perception: "Perception",
  Adresse: "Adresse",
  // Esprit
  Savoir: "Savoir",
  "Sang-froid": "Sang-Froid",
  Précision: "Precision",
  Logique: "Logique",
  Discrétion: "Discretion",
  // Âme
  Charisme: "Charisme",
  Courage: "Courage",
  Influence: "Influence",
  Instinct: "Instinct",
  Empathie: "Empathie",
};

// Older sheets use PDF-name byte escapes for accented field names.
const normalizeImportFieldName = (name: string) => {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name.replace(/#([0-9a-f]{2})/gi, "%$1"));
  } catch { /* retain unusual field names as-is */ }
  return decoded.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const IMPORT_FIELD_ALIASES: Record<string, string[]> = {
  Adresse: ["Coordination"],
  Logique: ["Analyse"],
  Courage: ["Volonte"],
  Repliquefetiche1: ["Replique fetiche"],
  "Histoire et Notes": ["Histoire"],
};

type DefaultAppearanceTarget = {
  getDefaultAppearance: () => string | undefined;
  setDefaultAppearance: (appearance: string) => void;
};

const TF_OPERATOR = /\/([^\s]+)\s+[-+]?(?:\d+\.?\d*|\.\d+)\s+Tf/g;
const DEFAULT_MAX_FONT_SIZE = 13;
const FIELD_MAX_FONT_SIZE: Record<string, number> = {
  Traits: 16,
  Specialite: 16,
  "Histoire et Notes": 11,
  Inventaire: 11,
  Concept: 12,
  Repliquefetiche1: 12,
};

for (let i = 1; i <= 3; i += 1) {
  FIELD_MAX_FONT_SIZE[`NomArme${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`DegatsArme${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`ProprieteArme${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`NomArmure${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`PoidsArmure${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`ProtectionArmure${i}`] = 12;
  FIELD_MAX_FONT_SIZE[`SpecialArmure${i}`] = 12;
}

const setAutoFontSize = (target: DefaultAppearanceTarget) => {
  const appearance = target.getDefaultAppearance();
  if (!appearance) return;

  const matches = [...appearance.matchAll(TF_OPERATOR)];
  const match = matches.at(-1);
  if (!match || match.index === undefined) return;

  const before = appearance.slice(0, match.index);
  const after = appearance.slice(match.index + match[0].length);
  target.setDefaultAppearance(`${before}/${match[1]} 0 Tf${after}`);
};

const enableAutoFontSize = (field: PDFTextField) => {
  try {
    setAutoFontSize(field.acroField);
    field.acroField.getWidgets().forEach(setAutoFontSize);
  } catch {
    /* keep the template defaults if a field has an unusual appearance */
  }
};

const normalizeProtectionDigits = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(6, "0").slice(0, 6);
};

const computeBestArmorProtection = (c: Character) => {
  const best = Array(6).fill(0);
  c.armures.forEach((armure) => {
    const digits = normalizeProtectionDigits(armure.protection);
    if (!/^[0-7]{6}$/.test(digits)) return;
    for (let i = 0; i < best.length; i += 1) {
      best[i] = Math.max(best[i], Number(digits[i]));
    }
  });
  return best;
};

const setFieldWidgetsVisible = (form: ReturnType<PDFDocument["getForm"]>, name: string, visible: boolean) => {
  try {
    const field = form.getFieldMaybe?.(name) ?? form.getField(name);
    const widgets = (field as any).acroField?.getWidgets?.() ?? [];
    widgets.forEach((widget: any) => {
      const flagsKey = widget.dict.keys().find((key: unknown) => String(key) === "/F");
      if (flagsKey) widget.dict.set(flagsKey, widget.dict.context.obj(visible ? 4 : 6));
    });
  } catch {
    /* missing optional overlay field */
  }
};

const setFieldReadOnly = (form: ReturnType<PDFDocument["getForm"]>, name: string, readOnly: boolean) => {
  try {
    const field = form.getFieldMaybe?.(name) ?? form.getField(name);
    if (readOnly) field.enableReadOnly();
    else field.disableReadOnly();
  } catch {
    /* missing optional field */
  }
};

const applyEditModeOffScript = (form: ReturnType<PDFDocument["getForm"]>) => {
  const editableFields = [
    "Nom",
    "Age",
    "Taille",
    "Poids",
    "Concept",
    "Repliquefetiche1",
    "Repliquefetiche2",
    "Traits",
    "Specialite",
    "Inventaire",
    "Point_recit",
  ];

  for (let i = 1; i <= 3; i += 1) {
    editableFields.push(
      `NomArme${i}`,
      `DegatsArme${i}`,
      `ProprieteArme${i}`,
      `SpecialArme${i}`,
      `NomArmure${i}`,
      `PoidsArmure${i}`,
      `ProtectionArmure${i}`,
      `SpecialArmure${i}`,
    );
  }

  Object.values(SKILL_PDF_NAME).forEach((fieldName) => {
    setFieldWidgetsVisible(form, fieldName, true);
    setFieldWidgetsVisible(form, `${fieldName}_base`, false);
  });

  editableFields.forEach((fieldName) => setFieldReadOnly(form, fieldName, true));

  for (let row = 1; row <= 6; row += 1) {
    for (let col = 1; col <= 7; col += 1) {
      setFieldReadOnly(form, `Blessure${row}${col}`, false);
    }
  }
};

const applyArmorVisibility = (form: ReturnType<PDFDocument["getForm"]>, c: Character) => {
  const bestProtection = computeBestArmorProtection(c);
  setText(form, "ProtectionMax", bestProtection.join(""));

  for (let row = 1; row <= bestProtection.length; row += 1) {
    for (let col = 1; col <= 7; col += 1) {
      setFieldWidgetsVisible(form, `BtnBlessure${row}${col}`, col <= bestProtection[row - 1]);
    }
  }
};

const setCheckbox = (form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean) => {
  try {
    const field = form.getFieldMaybe?.(name) ?? form.getField(name);
    if (field instanceof PDFCheckBox) {
      if (checked) field.check();
      else field.uncheck();
    }
  } catch {
    /* missing optional checkbox */
  }
};

const checkedTotal = (values: boolean[], capacities: number[]) =>
  values.reduce((sum, checked, index) => sum + (checked ? capacities[index] ?? 0 : 0), 0);

const computeInjuryPenalty = (c: Character) => {
  let penalty = 0;
  INJURY_LOCATIONS.forEach((location) => {
    const values = c.injuries[location] ?? [];
    const capacities = INJURY_CAPACITY[location] ?? [];
    values.forEach((checked, index) => {
      if (checked) penalty += capacities[index] ?? 0;
    });
  });
  return penalty;
};

const applyStateCheckboxes = (form: ReturnType<PDFDocument["getForm"]>, c: Character) => {
  INJURY_LOCATIONS.forEach((location, locationIndex) => {
    const row = locationIndex + 1;
    const values = c.injuries[location] ?? [];
    for (let col = 1; col <= 7; col += 1) {
      setCheckbox(form, `Blessure${row}${col}`, Boolean(values[col - 1]));
    }
  });

  for (let i = 1; i <= 7; i += 1) {
    setCheckbox(form, `Stress${i}`, Boolean(c.stress[i - 1]));
    setCheckbox(form, `Chagrin${i}`, Boolean(c.griefs[i - 1]));
  }
};

const applyPenalty = (baseValue: number, penalty: number) =>
  baseValue >= 0 ? Math.max(baseValue - penalty, 0) : baseValue - penalty;

const setFacetValues = (
  form: ReturnType<PDFDocument["getForm"]>,
  c: Character,
  penalties: Record<keyof Character["facets"], number>,
) => {
  (Object.keys(FACET_SKILLS) as Array<keyof typeof FACET_SKILLS>).forEach((facet) => {
    const effectiveValues = FACET_SKILLS[facet].map((skill) => {
      const pdfName = SKILL_PDF_NAME[skill];
      const baseValue = c.facets[facet].skills[skill] ?? 0;
      const effectiveValue = applyPenalty(baseValue, penalties[facet]);
      if (pdfName) {
        setText(form, pdfName, String(effectiveValue));
        setText(form, `${pdfName}_base`, String(baseValue));
      }
      return effectiveValue;
    });

    const coreValue = Math.max(...effectiveValues);
    const pdfCoreName = facet === "ame" ? "Ame" : facet[0].toUpperCase() + facet.slice(1);
    setText(form, pdfCoreName, String(coreValue));
  });

  setFieldWidgetsVisible(form, "ImageAlerteCorps", Math.max(...FACET_SKILLS.corps.map((s) => applyPenalty(c.facets.corps.skills[s] ?? 0, penalties.corps))) === 0);
  setFieldWidgetsVisible(form, "ImageAlerteEsprit", Math.max(...FACET_SKILLS.esprit.map((s) => applyPenalty(c.facets.esprit.skills[s] ?? 0, penalties.esprit))) === 0);
  setFieldWidgetsVisible(form, "ImageAlerteChagrin", Math.max(...FACET_SKILLS.ame.map((s) => applyPenalty(c.facets.ame.skills[s] ?? 0, penalties.ame))) === 0);
};

const restoreEditableAutoSizing = (form: ReturnType<PDFDocument["getForm"]>) => {
  form.getFields().forEach((field) => {
    if (field instanceof PDFTextField) enableAutoFontSize(field);
  });
};

const estimateFontSize = (field: PDFTextField, value: string, maxSize: number) => {
  const widgets = field.acroField.getWidgets();
  const rect = widgets[0]?.getRectangle();
  if (!rect || !value.trim()) return maxSize;

  const lines = value.split(/\r?\n/);
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const padding = 3;
  const width = Math.max(rect.width - padding * 2, 1);
  const height = Math.max(rect.height - padding * 2, 1);
  const widthFit = width / (longestLine * 0.46);
  const heightFit = height / (Math.max(lines.length, 1) * 1.05);
  return Math.max(4, Math.min(maxSize, widthFit, heightFit));
};

const setText = (form: ReturnType<PDFDocument["getForm"]>, name: string, value: string, maxFontSize = FIELD_MAX_FONT_SIZE[name] ?? DEFAULT_MAX_FONT_SIZE) => {
  try {
    const field = form.getFieldMaybe?.(name) ?? form.getField(name);
    if (field instanceof PDFTextField) {
      enableAutoFontSize(field);
      field.setFontSize(estimateFontSize(field, value ?? "", maxFontSize));
      field.setText(value ?? "");
    }
  } catch {
    /* field missing — ignore */
  }
};

const readEmbeddedCharacterJson = (pdf: PDFDocument): Character | null => {
  try {
    const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
    const embeddedFiles = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
    const fileNames = embeddedFiles?.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (!fileNames) return null;

    for (let index = 0; index < fileNames.size(); index += 2) {
      const fileName = fileNames.lookup(index) as { decodeText?: () => string } | undefined;
      if (fileName?.decodeText?.() !== CHARACTER_PDF_ATTACHMENT_NAME) continue;

      const fileSpec = fileNames.lookup(index + 1, PDFDict);
      const ef = fileSpec.lookupMaybe(PDFName.of("EF"), PDFDict);
      const stream = ef?.lookup(PDFName.of("F"));
      if (!(stream instanceof PDFRawStream)) continue;

      const json = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return migrateCharacter(validateImportedCharacter(parseJsonData(json)));
    }
  } catch {
    return null;
  }

  return null;
};

const readPayloadField = (pdf: PDFDocument): Character | null => {
  try {
    const form = pdf.getForm();
    const field = form.getFieldMaybe?.(CHARACTER_PDF_PAYLOAD_FIELD) ?? form.getField(CHARACTER_PDF_PAYLOAD_FIELD);
    if (!(field instanceof PDFTextField)) return null;
    return decodeCharacterPdfPayload(field.getText());
  } catch {
    return null;
  }
};

export const renderCharacterPdf = async (c: Character): Promise<Blob> => {
  const res = await fetch("/ClapOwlBear/templates/FichePersonnageInteractive.pdf");
  if (!res.ok) throw new Error("Template PDF introuvable");
  const bytes = await res.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  // Identity
  setText(form, "Nom", c.nom);
  setText(form, "Age", c.age);
  setText(form, "Taille", c.taille);
  setText(form, "Poids", c.poids);
  setText(form, "Concept", c.concept);
  setText(form, "Repliquefetiche1", c.replique);
  setText(form, "Point_recit", String(c.pointsRecits ?? ""));
  setCheckbox(form, "Edit", false);

  // Facets cores (raw, ignore sequelles)
  applyStateCheckboxes(form, c);
  setFacetValues(form, c, {
    corps: computeInjuryPenalty(c),
    esprit: checkedTotal(c.stress, STRESS_CAPACITY),
    ame: checkedTotal(c.griefs, GRIEF_CAPACITY),
  });

  // Skills — raw value in both <Skill> and <Skill>_base
  // Traits / Spécialité / Lore
  setText(form, "Traits", c.traits);
  setText(form, "Specialite", c.specialite);
  setText(form, "Histoire et Notes", c.lore);

  // Armes (jusqu'à 3)
  c.armes.slice(0, 3).forEach((a, i) => {
    const n = i + 1;
    setText(form, `NomArme${n}`, a.nom);
    setText(form, `DegatsArme${n}`, a.degats);
    setText(form, `ProprieteArme${n}`, a.proprietes);
  });

  // Armures (jusqu'à 3)
  c.armures.slice(0, 3).forEach((a, i) => {
    const n = i + 1;
    setText(form, `NomArmure${n}`, a.nom);
    setText(form, `PoidsArmure${n}`, a.poids);
    setText(form, `ProtectionArmure${n}`, a.protection);
    setText(form, `SpecialArmure${n}`, a.proprietes);
  });

  applyArmorVisibility(form, c);

  // Autres accessoires → Inventaire
  const inv = c.autresAccessoires
    .map((a) => [a.nom + ((a.quantite ?? 1) > 1 ? ` x ${a.quantite}` : ""), a.proprietes].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n");
  setText(form, "Inventaire", inv);

  applyEditModeOffScript(form);
  form.updateFieldAppearances();
  restoreEditableAutoSizing(form);

  const out = await pdf.save({ updateFieldAppearances: false });
  // Copy into a plain ArrayBuffer to satisfy BlobPart typing
  const ab = new ArrayBuffer(out.byteLength);
  new Uint8Array(ab).set(out);
  return new Blob([ab], { type: "application/pdf" });
};

export const exportCharacterPdf = async (c: Character) => {
  const blob = await renderCharacterPdf(c);
  downloadBlob(blob, `${(c.nom || "personnage").replace(/\s+/g, "_")}.pdf`);
};

export const importCharacterPdf = async (file: File): Promise<Character | null> => {
  try {
    if (file.size > MAX_IMPORT_BYTES) return null;
    const pdf = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
    const finalizeImportedCharacter = async (character: Character) => {
      character = migrateCharacter(character);
      character.id = crypto.randomUUID();
      character.updatedAt = Date.now();
      return importResourceBundle(pdf, character);
    };
    const payloadCharacter = decodeCharacterPdfPayload(pdf.getSubject());
    if (payloadCharacter) {
      return finalizeImportedCharacter(payloadCharacter);
    }
    const fieldCharacter = readPayloadField(pdf);
    if (fieldCharacter) {
      return finalizeImportedCharacter(fieldCharacter);
    }
    const embeddedCharacter = readEmbeddedCharacterJson(pdf);
    if (embeddedCharacter) {
      return finalizeImportedCharacter(embeddedCharacter);
    }

    const form = pdf.getForm();
    const character = blankCharacter();

    // Recognize the interactive hero sheet before creating a character.
    const fields = new Map(form.getFields().map((field) => [normalizeImportFieldName(field.getName()), field]));
    if (!fields.has("nom") || !Object.values(SKILL_PDF_NAME).some(
      (name) => fields.has(normalizeImportFieldName(name)) || fields.has(normalizeImportFieldName(`${name}_base`)),
    )) return null;

    const getText = (name: string) => {
      try {
        for (const candidate of [name, ...(IMPORT_FIELD_ALIASES[name] ?? [])]) {
          const field = fields.get(normalizeImportFieldName(candidate));
          if (field instanceof PDFTextField && field.getText()?.trim()) {
            return field.getText()!.replace(/\r\n?/g, "\n");
          }
        }
        return "";
      } catch {
        return "";
      }
    };

    const getNumberWithBase = (name: string, fallback = 0) => {
      const names = [name, ...(IMPORT_FIELD_ALIASES[name] ?? [])];
      for (const value of [...names.map(candidate => getText(`${candidate}_base`)), ...names.map(getText)]) {
        const parsed = Number(value.trim());
        if (value.trim() && Number.isInteger(parsed)) return parsed;
      }
      return fallback;
    };
    const isChecked = (name: string) => {
      try {
        const field = form.getFieldMaybe?.(name) ?? form.getField(name);
        return field instanceof PDFCheckBox ? field.isChecked() : false;
      } catch {
        return false;
      }
    };

    character.nom = [getText("Nom"), getText("Prenoms")].filter(Boolean).join(" ");
    character.age = getText("Age");
    character.taille = getText("Taille");
    character.poids = getText("Poids");
    character.concept = getText("Concept");
    character.replique = [getText("Repliquefetiche1"), getText("Repliquefetiche2")].filter(Boolean).join("\n");
    character.traits = getText("Traits");
    character.specialite = getText("Specialite");
    character.lore = getText("Histoire et Notes");
    character.pointsRecits = Number.parseInt(getText("Point_recit"), 10) || 0;

    (Object.keys(FACET_SKILLS) as Array<keyof typeof FACET_SKILLS>).forEach((facet) => {
      const skills: Record<string, number> = {};
      FACET_SKILLS[facet].forEach((skill) => {
        const pdfName = SKILL_PDF_NAME[skill];
        skills[skill] = getNumberWithBase(pdfName);
      });
      character.facets[facet] = {
        ...character.facets[facet],
        core: Math.max(...Object.values(skills)),
        skills,
      };
    });

    character.armes = [1, 2, 3]
      .map((n) => ({
        nom: getText(`NomArme${n}`),
        degats: getText(`DegatsArme${n}`),
        proprietes: [getText(`ProprieteArme${n}`), getText(`SpecialArme${n}`)].filter(Boolean).join("\n"),
      }))
      .filter((arme) => arme.nom || arme.degats || arme.proprietes);

    character.armures = [1, 2, 3]
      .map((n) => ({
        nom: getText(`NomArmure${n}`),
        poids: getText(`PoidsArmure${n}`),
        protection: getText(`ProtectionArmure${n}`),
        proprietes: getText(`SpecialArmure${n}`),
      }))
      .filter((armure) => armure.nom || armure.poids || armure.protection || armure.proprietes);

    const inventaire = getText("Inventaire");
    character.autresAccessoires = inventaire
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = /\s+—\s+|\s+-\s+|:\s*/.exec(line);
        if (!separator) return { nom: line, proprietes: "" };
        return {
          nom: line.slice(0, separator.index).trim(),
          proprietes: line.slice(separator.index + separator[0].length).trim(),
        };
      });

    character.injuries = Object.fromEntries(
      INJURY_LOCATIONS.map((location, locationIndex) => [
        location,
        Array.from({ length: 7 }, (_, colIndex) => isChecked(`Blessure${locationIndex + 1}${colIndex + 1}`)),
      ]),
    );
    character.stress = Array.from({ length: 7 }, (_, index) => isChecked(`Stress${index + 1}`));
    character.griefs = Array.from({ length: 7 }, (_, index) => isChecked(`Chagrin${index + 1}`));

    return finalizeImportedCharacter(character);
  } catch {
    return null;
  }
};
