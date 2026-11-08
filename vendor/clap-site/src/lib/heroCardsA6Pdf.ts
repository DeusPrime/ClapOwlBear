import { localizeText } from '@/i18n/localize';
import { PDFDocument, PDFPage, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import { exportRange, reportExportProgress } from "./exportProgress";
import {
  Character,
  FACET_LABELS,
  FACET_SKILLS,
  Facet,
  GRIEF_CAPACITY,
  GRIEF_LEVELS,
  INJURY_CAPACITY,
  INJURY_LEVELS,
  INJURY_LOCATIONS,
  STRESS_CAPACITY,
  STRESS_LEVELS,
} from "./characters";
import { downloadBlob } from "./characterPng";
import { collectPdfFontCss } from "./pdfFontCss";
import { CHARACTER_PDF_ATTACHMENT_NAME, CHARACTER_PDF_MARKER, CHARACTER_PDF_PAYLOAD_FIELD } from "./characterPdfPayload";
import { richTextToPlainText } from "./richText";
import { attachResourceBundle, loadLinkedBundledResources, renderBundledResourcePng, type BundledResource } from "./resourceBundle";
import { imagePngBlob } from "./imageEditing";
import { appendResourceBackPages } from "./resourceCardsPdf";

const MM = 2.83465;
const A4_W = 210 * MM;
const A4_H = 297 * MM;
const A6_W = 105 * MM;
const A6_H = 148 * MM;

const CARD_INK = rgb(0.22, 0.06, 0.02);
const PAPER = rgb(1, 0.985, 0.94);
const RED = rgb(0.498, 0.141, 0.059);
const GREEN = rgb(0.243, 0.478, 0.184);
const BLUE = rgb(0.145, 0.227, 0.447);
const BLACK = rgb(0.05, 0.04, 0.03);
const FAINT = rgb(0.92, 0.89, 0.82);
const CREAM = rgb(1, 0.96, 0.88);
const WHITE = rgb(1, 1, 1);

const STATE_HEADER_FONT_SIZE = 9;
const STATE_NUMBER_FONT_SIZE = 7;
const STATE_LEVEL_FONT_SIZE = 4.7;
const STATE_LOCATION_FONT_SIZE = 9;
const STATE_PROTECTION_FONT_SIZE = 7.2;
const STATE_CELL_STEP = 20.2;
const STATE_TRACK_NUMBER_FONT_SIZE = 7.6;
const STATE_TRACK_LABEL_FONT_SIZE = 4.7;

type Fonts = {
  body: PDFFont;
  bold: PDFFont;
  title: PDFFont;
};

const safeFileName = (name: string) => (name || "personnage").replace(/\s+/g, "_");

const appendLinkedResourcePages = async (pdf: PDFDocument, resources: BundledResource[], includeBacks = true) => {
  const cardWidth = 63 * MM;
  const cardHeight = 88 * MM;
  const gutter = 3 * MM;
  const columns = 3;
  const rows = 3;
  const perPage = columns * rows;
  const marginX = (A4_W - columns * cardWidth - (columns - 1) * gutter) / 2;
  const marginY = (A4_H - rows * cardHeight - (rows - 1) * gutter) / 2;
  for (let start = 0; start < resources.length; start += perPage) {
    const page = pdf.addPage([A4_W, A4_H]);
    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    const pageResources = resources.slice(start, start + perPage);
    for (let index = 0; index < pageResources.length; index += 1) {
      const blob = await renderBundledResourcePng(pageResources[index]);
      const image = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
      const column = index % columns;
      const row = Math.floor(index / columns);
      page.drawImage(image, {
        x: marginX + column * (cardWidth + gutter),
        y: A4_H - marginY - cardHeight - row * (cardHeight + gutter),
        width: cardWidth,
        height: cardHeight,
      });
    }
  }
  if (includeBacks) await appendResourceBackPages(pdf, resources.map(resource => ({ ...resource.item, resourceType: resource.type })));
};

const attachCharacterPayload = async (pdf: PDFDocument, c: Character) => {
  pdf.setTitle(`${c.nom || "Personnage"} - Cartes A6`);
  pdf.setSubject(CHARACTER_PDF_MARKER);
  pdf.setKeywords(["clap-role-character", "clap-role-a6"]);
  const field = pdf.getForm().createTextField(CHARACTER_PDF_PAYLOAD_FIELD);
  field.setText(CHARACTER_PDF_MARKER);
  field.enableReadOnly();
  field.addToPage(pdf.getPages()[0] ?? pdf.addPage([A4_W, A4_H]), {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    borderWidth: 0,
    textColor: rgb(1, 1, 1),
    backgroundColor: rgb(1, 1, 1),
  });
  await pdf.attach(new TextEncoder().encode(JSON.stringify(c)), CHARACTER_PDF_ATTACHMENT_NAME, {
    mimeType: "application/json",
    description: "Donnees du personnage Clap & Role",
    creationDate: new Date(),
    modificationDate: new Date(),
  });
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const resourceDataUrls = new Map<string, Promise<string>>();

const resourceToDataUrl = (url: string) => {
  const absoluteUrl = new URL(url, window.location.href).href;
  if (!resourceDataUrls.has(absoluteUrl)) {
    resourceDataUrls.set(
      absoluteUrl,
      fetch(absoluteUrl).then((response) => {
        if (!response.ok) throw new Error(`Ressource introuvable: ${absoluteUrl}`);
        return response.blob().then(blobToDataUrl);
      }),
    );
  }
  return resourceDataUrls.get(absoluteUrl)!;
};

const inlineCssUrls = async (cssText: string) => {
  const replacements = await Promise.all(
    Array.from(cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map(async ([full, url]) => {
      if (!url || url.startsWith("data:") || url.startsWith("#")) return [full, full] as const;
      try {
        return [full, `url("${await resourceToDataUrl(url)}")`] as const;
      } catch {
        return [full, full] as const;
      }
    }),
  );

  return replacements.reduce((next, [from, to]) => next.replaceAll(from, to), cssText);
};

const sanitizeCssForCanvas = (cssText: string) =>
  cssText
    .replace(/@import[^;]+;/g, "")
    .replace(/@font-face\s*{[^}]*}/g, "")
    .replace(/url\(["']?https?:\/\/[^"')]+["']?\)/g, "none")
    .replace(/url\(["']?data:image\/svg\+xml[^"')]+["']?\)/g, "none");

const collectStylesheetText = async () => {
  const cssText = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => {
            const text = rule.cssText;
            if (text.startsWith("@import") || text.startsWith("@font-face")) return "";
            return text;
          })
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  const [styles, fonts] = await Promise.all([
    inlineCssUrls(sanitizeCssForCanvas(cssText)),
    collectPdfFontCss(document.styleSheets, resourceToDataUrl).catch((error) => {
      console.warn("Polices indisponibles, utilisation des polices de secours pour le PDF.", error);
      return "";
    }),
  ]);
  return `${styles}\n${fonts}`;
};

const inlineCloneImages = async (source: HTMLElement, clone: HTMLElement) => {
  const images = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        img.setAttribute("src", await resourceToDataUrl(src));
      } catch {
        /* Optional images stay as-is if they cannot be inlined. */
      }
    }),
  );

  const svgImages = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    svgImages.map(async (image) => {
      const href = image.getAttribute("href") || image.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        image.setAttribute("href", await resourceToDataUrl(href));
        image.removeAttribute("xlink:href");
      } catch {
        /* Optional images stay as-is if they cannot be inlined. */
      }
    }),
  );

  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  await Promise.all(
    sourceElements.map(async (sourceElement, index) => {
      const backgroundImage = getComputedStyle(sourceElement).backgroundImage;
      if (!backgroundImage || backgroundImage === "none" || !backgroundImage.includes("url(")) return;
      const cloneElement = cloneElements[index];
      if (!cloneElement) return;
      const replacements = await Promise.all(
        Array.from(backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map(async ([full, url]) => {
          try {
            return [full, `url("${await resourceToDataUrl(url)}")`] as const;
          } catch {
            return [full, full] as const;
          }
        }),
      );
      cloneElement.style.backgroundImage = replacements.reduce((next, [from, to]) => next.replace(from, to), backgroundImage);
    }),
  );
};

const cardElementToPngBytes = async (card: HTMLElement, cssText: string, inkHex: string, scale = 3) => {
  await document.fonts?.ready;

  const clone = card.cloneNode(true) as HTMLElement;
  const computedCardInk = getComputedStyle(card).getPropertyValue("--hero-card-ink").trim();
  clone.style.setProperty("--hero-card-ink", inkHex || computedCardInk || "#3a1307");
  clone.classList.remove("hidden");
  clone.style.setProperty("display", "flex", "important");
  clone.style.setProperty("max-width", "none", "important");
  clone.style.setProperty("zoom", "1", "important");
  clone.style.setProperty("transform", "none", "important");
  clone.style.setProperty("box-shadow", "none", "important");
  await inlineCloneImages(card, clone);

  const measurer = document.createElement("div");
  measurer.style.position = "fixed";
  measurer.style.left = "-10000px";
  measurer.style.top = "0";
  measurer.style.width = "max-content";
  measurer.style.pointerEvents = "none";
  measurer.appendChild(clone);
  document.body.appendChild(measurer);

  const rect = clone.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const html = new XMLSerializer().serializeToString(clone);
  document.body.removeChild(measurer);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#fff"/>
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:#fff;">
          <style><![CDATA[${cssText}]]></style>
          <style>
            <![CDATA[
            * { box-sizing: border-box; }
            .hero-print-card {
              background: #fff !important;
              box-shadow: none !important;
              height: 148mm !important;
              max-width: none !important;
              transform: none !important;
              width: 105mm !important;
              zoom: 1 !important;
            }
            .hero-card-has-header {
              background: #fff !important;
            }
            .hidden { display: flex !important; }
            .hero-card-check-menu,
            .hero-card-color-picker {
              display: none !important;
            }
            ]]>
          </style>
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  try {
    image.crossOrigin = "anonymous";
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((next) => {
          if (next) resolve(next);
          else reject(new Error("La capture de la carte a echoue."));
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    image.removeAttribute("src");
  }
};

const hexToRgb = (value: string): RGB => {
  const hex = value.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return CARD_INK;
  return rgb(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  );
};

const normalizeText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "'");

const lineText = (value: string, fallback = "-") => normalizeText(value).trim() || fallback;

const densityScale = (score: number, comfortableScore: number, minimum = 0.62) =>
  Math.max(minimum, Math.min(1, comfortableScore / Math.max(score, comfortableScore)));

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
};

const splitTextIntoCardPages = (value: string, maxChars = 1500) => {
  const text = value.trim();
  if (!text) return [""];
  const pages: string[] = [];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  let page = "";

  const pushPage = () => {
    if (page.trim()) pages.push(page.trim());
    page = "";
  };

  paragraphs.forEach((paragraph) => {
    const next = page ? `${page}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars) {
      page = next;
      return;
    }
    if (page) pushPage();
    if (paragraph.length <= maxChars) {
      page = paragraph;
      return;
    }
    paragraph.split(/\s+/).forEach((word) => {
      const candidate = page ? `${page} ${word}` : word;
      if (candidate.length > maxChars && page) pushPage();
      page = page ? `${page} ${word}` : word;
    });
  });

  pushPage();
  return pages.length ? pages : [""];
};

const drawTextBlock = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  font: PDFFont,
  size: number,
  color = BLACK,
  maxLines = 99,
) => {
  const lines = wrapText(text, font, size, width).slice(0, maxLines);
  lines.forEach((line, index) => {
    page.drawText(localizeText(line), { x, y: y - index * lineHeight, size, font, color });
  });
  return y - lines.length * lineHeight;
};

const drawPerforation = (page: PDFPage, x: number, y: number, width: number, color = rgb(1, 0.96, 0.88)) => {
  const step = 7;
  for (let dotX = x; dotX <= x + width; dotX += step) {
    page.drawCircle({ x: dotX, y, size: 1.7, color });
  }
};

const drawCardBase = (page: PDFPage, x: number, y: number, title: string, fonts: Fonts, ink: RGB) => {
  page.drawRectangle({ x, y, width: A6_W, height: A6_H, color: ink });
  page.drawRectangle({ x: x + 7, y: y + 7, width: A6_W - 14, height: A6_H - 14, color: PAPER });
  const headerH = 29;
  page.drawRectangle({ x: x + 7, y: y + A6_H - headerH - 7, width: A6_W - 14, height: headerH, color: ink });
  drawPerforation(page, x + 18, y + A6_H - 13, A6_W - 36);
  drawPerforation(page, x + 18, y + A6_H - headerH - 13, A6_W - 36);
  const iconX = x + 19;
  const iconY = y + A6_H - 22;
  if (title === "Identite") {
    page.drawCircle({ x: iconX, y: iconY + 1, size: 5, color: CREAM });
  } else if (title === "Traits") {
    page.drawText(localizeText("*"), { x: iconX - 4, y: iconY - 5, size: 20, font: fonts.bold, color: CREAM });
  } else {
    page.drawCircle({ x: iconX, y: iconY + 1, size: 5, color: CREAM });
  }
  page.drawText(localizeText(normalizeText(title).toUpperCase()), {
    x: x + 34,
    y: y + A6_H - 24,
    size: 11,
    font: fonts.bold,
    color: CREAM,
  });
};

const drawStoryPoints = (page: PDFPage, c: Character, x: number, y: number, fonts: Fonts, ink: RGB) => {
  if ((c.pointsRecits ?? 0) === 0) return;
  page.drawRectangle({ x: x + A6_W - 116, y: y + 38, width: 102, height: 22, borderColor: ink, borderWidth: 1 });
  page.drawText(localizeText("POINTS DE RECIT"), { x: x + A6_W - 108, y: y + 46, size: 6.2, font: fonts.bold, color: ink });
  page.drawText(localizeText(String(c.pointsRecits ?? 0)), { x: x + A6_W - 35, y: y + 43, size: 13, font: fonts.bold, color: ink });
};

const drawSection = (
  page: PDFPage,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fonts: Fonts,
  color = CARD_INK,
  border = true,
) => {
  if (border) page.drawRectangle({ x, y, width, height, borderColor: color, borderWidth: 1 });
  page.drawText(localizeText(normalizeText(title).toUpperCase()), {
    x: x + 4,
    y: y + height - 12,
    size: 9,
    font: fonts.bold,
    color,
  });
};

const drawFadedImage = async (
  pdf: PDFDocument,
  page: PDFPage,
  path: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
) => {
  try {
    const image = await pdf.embedPng(await assetBytes(path));
    page.drawImage(image, { x, y, width, height, opacity });
  } catch {
    /* decorative image */
  }
};

const assetBytes = async (path: string) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Asset introuvable: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
};

const bestArmorProtection = (c: Character) => {
  const best = Array(6).fill(0);
  c.armures.forEach((armure) => {
    const digits = String(armure.protection || "").replace(/\D/g, "").padStart(6, "0").slice(0, 6);
    if (!/^\d{6}$/.test(digits)) return;
    for (let index = 0; index < 6; index += 1) {
      best[index] = Math.max(best[index], Number(digits[index]));
    }
  });
  return Object.fromEntries(INJURY_LOCATIONS.map((loc, index) => [loc, best[index] ?? 0]));
};

const checkedTotal = (values: boolean[], capacities: number[]) =>
  values.reduce((sum, checked, index) => sum + (checked ? capacities[index] ?? 0 : 0), 0);

const injuryPenalty = (c: Character) =>
  INJURY_LOCATIONS.reduce((sum, location) => sum + checkedTotal(c.injuries[location] ?? [], INJURY_CAPACITY[location] ?? []), 0);

const penaltiesByFacet = (c: Character): Record<Facet, number> => ({
  corps: injuryPenalty(c),
  esprit: checkedTotal(c.stress, STRESS_CAPACITY),
  ame: checkedTotal(c.griefs, GRIEF_CAPACITY),
});

const stateCriticalSummary = (c: Character) => ({
  agony: Object.values(c.criticalStates.agony).some(Boolean),
  mentalBreak: c.criticalStates.mentalBreak,
  emotionalBreak: c.criticalStates.emotionalBreak,
});

const drawIdentityCard = (page: PDFPage, c: Character, historyText: string, historyIndex: number, historyTotal: number, x: number, y: number, fonts: Fonts, ink: RGB) => {
  drawCardBase(page, x, y, "Identite", fonts, ink);
  drawStoryPoints(page, c, x, y, fonts, ink);

  page.drawText(localizeText(lineText(c.nom, "").toUpperCase()), { x: x + 14, y: y + A6_H - 62, size: 18, font: fonts.title, color: ink });
  const detailsY = y + A6_H - 84;
  page.drawText(localizeText(`AGE ${lineText(c.age, "")}`), { x: x + 14, y: detailsY, size: 7, font: fonts.bold, color: ink });
  page.drawText(localizeText(`TAILLE ${lineText(c.taille, "")}`), { x: x + 94, y: detailsY, size: 7, font: fonts.bold, color: ink });
  page.drawText(localizeText(`POIDS ${lineText(c.poids, "")}`), { x: x + 190, y: detailsY, size: 7, font: fonts.bold, color: ink });
  drawTextBlock(page, c.concept, x + 14, y + A6_H - 104, A6_W - 28, 8, fonts.body, 7, ink, 5);

  const left = x + 14;
  const width = A6_W - 28;
  const historyScale = densityScale(historyText.length, 660, 0.68);
  drawSection(page, historyTotal > 1 ? `Histoire ${historyIndex + 1}/${historyTotal}` : "Histoire", left, y + 35, width, 242, fonts, ink);
  drawTextBlock(page, historyText, left + 8, y + 253, width - 16, 8 * historyScale, fonts.body, 7 * historyScale, BLACK, Math.floor(185 / (8 * historyScale)));

  const quote = normalizeText(c.replique);
  if (quote) page.drawText(localizeText(`"${quote.slice(0, 58)}"`), { x: x + 16, y: y + 13, size: 6.2, font: fonts.bold, color: ink });
};

const drawAttributeCard = async (pdf: PDFDocument, page: PDFPage, c: Character, x: number, y: number, fonts: Fonts, ink: RGB) => {
  drawCardBase(page, x, y, "Attributs", fonts, ink);
  const sectionX = x + 14;
  const sectionY = y + 108;
  const penalties = penaltiesByFacet(c);

  const reels: Array<{ facet: Facet; path: string; dx: number; dy: number; color: RGB }> = [
    { facet: "corps", path: "/ClapOwlBear/reels/corps.png", dx: 54, dy: 62, color: RED },
    { facet: "esprit", path: "/ClapOwlBear/reels/esprit.png", dx: 18, dy: 8, color: GREEN },
    { facet: "ame", path: "/ClapOwlBear/reels/ame.png", dx: 108, dy: 8, color: BLUE },
  ];

  for (const reel of reels) {
    const img = await pdf.embedPng(await assetBytes(reel.path));
    const names = FACET_SKILLS[reel.facet];
    const effectiveSkill = (name: string) => {
      const base = c.facets[reel.facet].skills[name] ?? 0;
      return base >= 0 ? Math.max(base - penalties[reel.facet], 0) : base;
    };
    const core = Math.max(...names.map(effectiveSkill));
    const coreX = sectionX + reel.dx + 62 + (reel.facet === "ame" ? -2 : 0);
    const coreY = sectionY + reel.dy + (reel.facet === "corps" ? 57 : 59);
    page.drawImage(img, { x: sectionX + reel.dx, y: sectionY + reel.dy, width: 135, height: 135 });
    page.drawText(localizeText(normalizeText(FACET_LABELS[reel.facet]).toUpperCase()), {
      x: sectionX + reel.dx + 43,
      y: sectionY + reel.dy + 126,
      size: 9.4,
      font: fonts.bold,
      color: reel.color,
    });
    page.drawText(localizeText(String(core)), { x: coreX, y: coreY, size: 17, font: fonts.bold, color: reel.color });
  }

  const specialiteText = richTextToPlainText(c.specialite);
  const specialiteScale = densityScale(specialiteText.length, 150);
  drawSection(page, "Specialites", x + 14, y + 35, A6_W - 28, 60, fonts, ink);
  drawTextBlock(page, specialiteText, x + 22, y + 75, A6_W - 44, 8 * specialiteScale, fonts.body, 7 * specialiteScale, BLACK, Math.floor(32 / (8 * specialiteScale)));

  const quote = normalizeText(c.replique);
  if (quote) page.drawText(localizeText(`"${quote.slice(0, 58)}"`), { x: x + 16, y: y + 13, size: 6.2, font: fonts.bold, color: ink });
};

const gearItems = (c: Character) => [
  ...c.armes.map((item) => ({ name: item.nom, detail: [item.degats, item.proprietes].filter(Boolean).join(" - ") })),
  ...c.armures.map((item) => ({ name: item.nom, detail: [item.poids && `${item.poids} kg`, item.protection, item.proprietes].filter(Boolean).join(" - ") })),
  ...c.autresAccessoires.map((item) => ({ name: item.nom + ((item.quantite ?? 1) > 1 ? ` x ${item.quantite}` : ""), detail: richTextToPlainText(item.proprietes) })),
];

const drawInventoryText = (page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = BLACK) => {
  page.drawText(localizeText(normalizeText(text).slice(0, 28)), { x, y, size, font, color });
};

const drawTextCard = async (pdf: PDFDocument, page: PDFPage, c: Character, x: number, y: number, fonts: Fonts, ink: RGB) => {
  drawCardBase(page, x, y, "Traits", fonts, ink);
  const left = x + 14;
  const width = A6_W - 28;
  const weapons = c.armes.filter((item) => item.nom || item.degats || item.proprietes);
  const armors = c.armures.filter((item) => item.nom || item.poids || item.protection || item.proprietes);
  const notes = c.autresAccessoires.map((item) => [item.nom + ((item.quantite ?? 1) > 1 ? ` x ${item.quantite}` : ""), richTextToPlainText(item.proprietes)].filter(Boolean).join(" — ")).filter(Boolean).join("\n");
  const items = [
    ...weapons.map((item) => ({ name: item.nom, detail: [item.degats, item.proprietes].filter(Boolean).join(" - ") })),
    ...armors.map((item) => ({ name: item.nom, detail: [item.poids && `${item.poids} kg`, item.protection, item.proprietes].filter(Boolean).join(" - ") })),
    { name: "", detail: notes },
  ].filter((item) => item.name || item.detail);
  const traitsText = richTextToPlainText(c.traits);
  const traitsScale = densityScale(traitsText.length, 360);
  const inventoryScore = items.reduce((sum, item) => sum + item.name.length * 1.2 + item.detail.length, 0) + items.length * 26;
  const inventoryScale = densityScale(inventoryScore, 460, 0.56);
  drawSection(page, "Traits", left, y + 236, width, 144, fonts, ink);
  await drawFadedImage(pdf, page, "/ClapOwlBear/trait-background.png", left + 1, y + 237, width - 2, 142, 0.055);
  drawTextBlock(page, traitsText, left + 8, y + 352, width - 16, 8 * traitsScale, fonts.body, 7 * traitsScale, BLACK, Math.floor(102 / (8 * traitsScale)));
  drawSection(page, "Accessoires", left, y + 24, width, 198, fonts, ink);
  await drawFadedImage(pdf, page, "/ClapOwlBear/inventory-backpack.png", left + 11.75, y + 58, 84, 93.6, 0.045);
  await drawFadedImage(pdf, page, "/ClapOwlBear/inventory-armor.png", left + width - 99, y + 86, 84, 81.9, 0.045);
  await drawFadedImage(pdf, page, "/ClapOwlBear/inventory-pistol.png", left + 114.5, y + 63, 111.6, 68.4, 0.045);
  let rowY = y + 197;
  const rowStep = 10 * inventoryScale;
  const headerSize = 5.6 * inventoryScale;
  const bodySize = 6.2 * inventoryScale;

  if (weapons.length) {
    drawInventoryText(page, "ARME", left + 8, rowY, headerSize, fonts.bold, ink);
    drawInventoryText(page, "DEGATS", left + 78, rowY, headerSize, fonts.bold, ink);
    drawInventoryText(page, "PROPRIETES", left + 124, rowY, headerSize, fonts.bold, ink);
    rowY -= rowStep;
    weapons.slice(0, 4).forEach((item) => {
      drawInventoryText(page, item.nom, left + 8, rowY, bodySize, fonts.bold, ink);
      drawInventoryText(page, item.degats, left + 78, rowY, bodySize, fonts.body);
      drawInventoryText(page, item.proprietes, left + 124, rowY, bodySize, fonts.body);
      rowY -= rowStep;
    });
    rowY -= 2;
  }

  if (armors.length) {
    drawInventoryText(page, "ARMURE", left + 8, rowY, headerSize, fonts.bold, ink);
    drawInventoryText(page, "POIDS", left + 70, rowY, headerSize, fonts.bold, ink);
    drawInventoryText(page, "PROT.", left + 106, rowY, headerSize, fonts.bold, ink);
    drawInventoryText(page, "PROPRIETES", left + 146, rowY, headerSize, fonts.bold, ink);
    rowY -= rowStep;
    armors.slice(0, 4).forEach((item) => {
      drawInventoryText(page, item.nom, left + 8, rowY, bodySize, fonts.bold, ink);
      drawInventoryText(page, item.poids, left + 70, rowY, bodySize, fonts.body);
      drawInventoryText(page, item.protection, left + 106, rowY, bodySize, fonts.body);
      drawInventoryText(page, item.proprietes, left + 146, rowY, bodySize, fonts.body);
      rowY -= rowStep;
    });
    rowY -= 2;
  }

  drawTextBlock(page, notes, left + 8, rowY, width - 16, 7 * inventoryScale, fonts.body, bodySize, BLACK, Math.max(1, Math.floor((rowY - (y + 34)) / (7 * inventoryScale))));
  const quote = normalizeText(c.replique);
  if (quote) page.drawText(localizeText(`"${quote.slice(0, 58)}"`), { x: x + 16, y: y + 13, size: 6.2, font: fonts.bold, color: ink });
};

const drawCheck = (page: PDFPage, x: number, y: number, checked: boolean, color: RGB, font: PDFFont) => {
  page.drawRectangle({ x, y, width: 8, height: 8, borderColor: color, borderWidth: 0.8 });
  if (checked) page.drawText(localizeText("X"), { x: x + 1.6, y: y + 1.2, size: 6, color, font });
};

const drawProtection = (page: PDFPage, x: number, y: number, value: number, fonts: Fonts) => {
  page.drawCircle({ x: x + 4, y: y + 4, size: 5, borderColor: BLUE, borderWidth: 1.1 });
  page.drawText(localizeText(String(value)), { x: x + 1.1, y: y + 0.6, size: STATE_PROTECTION_FONT_SIZE, font: fonts.bold, color: BLUE });
};

const drawTrack = (page: PDFPage, values: boolean[], labels: string[], x: number, y: number, width: number, fonts: Fonts, color: RGB) => {
  const cellGap = (width - 7 * 8) / 6;
  labels.forEach((label, index) => {
    const cellX = x + index * (8 + cellGap);
    page.drawText(localizeText(String(index + 1)), { x: cellX + 2, y: y + 18, size: STATE_TRACK_NUMBER_FONT_SIZE, font: fonts.bold, color });
    page.drawText(localizeText(normalizeText(label).slice(0, 8)), { x: cellX - 5, y: y + 9, size: STATE_TRACK_LABEL_FONT_SIZE, font: fonts.bold, color: BLACK });
    drawCheck(page, cellX, y, Boolean(values[index]), color, fonts.bold);
  });
};

const drawCriticalSummary = (page: PDFPage, c: Character, x: number, y: number, width: number, fonts: Fonts, ink: RGB) => {
  const states = stateCriticalSummary(c);
  const items = [
    { label: "Agonie", checked: states.agony, color: RED },
    { label: "Délire", checked: states.mentalBreak, color: GREEN },
    { label: "Désespoir", checked: states.emotionalBreak, color: BLUE },
  ];
  const height = 24;
  const itemWidth = width / items.length;
  drawSection(page, "Etats critiques", x, y, width, height, fonts, ink);
  items.forEach((item, index) => {
    const itemX = x + index * itemWidth;
    const checkX = itemX + 8;
    const checkY = y + 4;
    page.drawRectangle({ x: checkX, y: checkY, width: 8, height: 8, color: WHITE });
    drawCheck(page, checkX, checkY, item.checked, item.color, fonts.bold);
    page.drawText(localizeText(normalizeText(item.label).toUpperCase()), {
      x: checkX + 13,
      y: y + 5,
      size: 6.2,
      font: fonts.bold,
      color: item.color,
    });
  });
};

const drawStateCard = async (pdf: PDFDocument, page: PDFPage, c: Character, x: number, y: number, fonts: Fonts, ink: RGB) => {
  drawCardBase(page, x, y, "Constantes", fonts, ink);
  const left = x + 14;
  const width = A6_W - 28;
  await drawFadedImage(pdf, page, "/ClapOwlBear/constantes-background.png", x + 2, y + 2, A6_W - 4, A6_H - 4, 0.05);
  const protection = bestArmorProtection(c);
  drawSection(page, "Blessures", left, y + 205, width, 181, fonts, RED);
  page.drawText(localizeText("Zone / protection"), { x: left + 8, y: y + 360, size: STATE_HEADER_FONT_SIZE, font: fonts.body, color: BLACK });
  INJURY_LEVELS.forEach((level, index) => {
    const cellX = left + 108 + index * STATE_CELL_STEP;
    page.drawText(localizeText(String(index + 1)), { x: cellX + 1.9, y: y + 360, size: STATE_NUMBER_FONT_SIZE, font: fonts.bold, color: RED });
    page.drawText(localizeText(normalizeText(level).slice(0, 7)), { x: cellX - 6, y: y + 352, size: STATE_LEVEL_FONT_SIZE, font: fonts.bold, color: BLACK });
  });
  INJURY_LOCATIONS.forEach((loc, row) => {
    const rowY = y + 334 - row * 21.5;
    wrapText(loc, fonts.bold, STATE_LOCATION_FONT_SIZE, 60).forEach((line, lineIndex) => {
      page.drawText(localizeText(line), { x: left + 8, y: rowY + 4 - lineIndex * 9, size: STATE_LOCATION_FONT_SIZE, font: fonts.bold, color: BLACK });
    });
    drawProtection(page, left + 70, rowY - 3, protection[loc] ?? 0, fonts);
    const values = c.injuries[loc] ?? [];
    values.forEach((checked, index) => drawCheck(page, left + 109 + index * STATE_CELL_STEP, rowY - 2, Boolean(checked), RED, fonts.bold));
  });

  drawSection(page, "Stress", left, y + 104, width, 76, fonts, GREEN);
  drawTrack(page, c.stress, STRESS_LEVELS, left + 20, y + 124, width - 36, fonts, GREEN);
  drawSection(page, "Chagrins", left, y + 24, width, 68, fonts, BLUE);
  drawTrack(page, c.griefs, GRIEF_LEVELS, left + 20, y + 44, width - 36, fonts, BLUE);
  drawCriticalSummary(page, c, left, y + 2, width, fonts, ink);
};

const drawLoreCard = (page: PDFPage, c: Character, text: string, index: number, total: number, x: number, y: number, fonts: Fonts, ink: RGB, title = "Lore") => {
  drawCardBase(page, x, y, title, fonts, ink);
  const left = x + 14;
  const width = A6_W - 28;
  drawSection(page, total > 1 ? `${title} ${index + 1}/${total}` : title, left, y + 35, width, 346, fonts, ink);
  drawTextBlock(page, text, left + 8, y + 358, width - 16, 8.2, fonts.body, 7, BLACK, 38);
  page.drawText(localizeText(normalizeText(c.nom).slice(0, 58)), { x: x + 16, y: y + 13, size: 6.2, font: fonts.bold, color: ink });
};

const appendA6BackPages = async (pdf: PDFDocument, count: number, draw: (page: PDFPage, x: number, y: number) => void) => {
  let page: PDFPage;
  for (let index = 0; index < count; index++) {
    const slot = index % 4;
    if (slot === 0) {
      page = pdf.addPage([A4_W, A4_H]);
      page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    }
    draw(page!, slot % 2 === 0 ? A6_W : 0, slot < 2 ? A4_H - A6_H : A4_H - A6_H * 2);
  }
};

const appendGeneratedBackPages = async (pdf: PDFDocument, c: Character, count: number, inkHex: string) => {
  const ink = hexToRgb(inkHex);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const portrait = c.portrait
    ? await pdf.embedPng(new Uint8Array(await (await imagePngBlob(c.portrait, 0)).arrayBuffer()))
    : undefined;
  await appendA6BackPages(pdf, count, (page, x, y) => {
    page.drawRectangle({ x, y, width: A6_W, height: A6_H, color: ink });
    page.drawRectangle({ x: x + 7, y: y + 7, width: A6_W - 14, height: A6_H - 14, color: PAPER });
    if (portrait) {
      const scale = Math.min((A6_W - 14) / portrait.width, (A6_H - 14) / portrait.height);
      const width = portrait.width * scale, height = portrait.height * scale;
      page.drawImage(portrait, { x: x + (A6_W - width) / 2, y: y + (A6_H - height) / 2, width, height });
    }
    const name = normalizeText(c.nom).trim();
    if (name) {
      const size = Math.min(22, (A6_W - 32) / font.widthOfTextAtSize(name, 1));
      page.drawRectangle({ x: x + 7, y: y + 7, width: A6_W - 14, height: 40, color: ink, opacity: 0.8 });
      page.drawText(localizeText(name), { x: x + (A6_W - font.widthOfTextAtSize(name, size)) / 2, y: y + 20, size, font, color: WHITE });
    }
  });
};

export const renderHeroCardsA6Pdf = async (c: Character, inkHex = "#3a1307"): Promise<Blob> => {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    body: await pdf.embedFont(StandardFonts.Courier),
    bold: await pdf.embedFont(StandardFonts.CourierBold),
    title: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const ink = hexToRgb(inkHex);
  const addWhitePage = () => {
    const nextPage = pdf.addPage([A4_W, A4_H]);
    nextPage.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    return nextPage;
  };
  let page = addWhitePage();
  let slot = 0;
  let frontCount = 0;
  const drawNextCard = async (draw: (page: PDFPage, x: number, y: number) => Promise<void> | void) => {
    if (slot >= 4) {
      page = addWhitePage();
      slot = 0;
    }
    const x = slot % 2 === 0 ? 0 : A6_W;
    const y = slot < 2 ? A4_H - A6_H : A4_H - A6_H * 2;
    slot += 1;
    frontCount += 1;
    await draw(page, x, y);
  };

  const historyPages = splitTextIntoCardPages(c.lore, 900);
  await drawNextCard((targetPage, x, y) => drawIdentityCard(targetPage, c, historyPages[0] ?? "", 0, historyPages.length, x, y, fonts, ink));
  for (let index = 1; index < historyPages.length; index += 1) {
    await drawNextCard((targetPage, x, y) => drawLoreCard(targetPage, c, historyPages[index], index, historyPages.length, x, y, fonts, ink, "Histoire"));
  }
  await drawNextCard((targetPage, x, y) => drawAttributeCard(pdf, targetPage, c, x, y, fonts, ink));
  await drawNextCard((targetPage, x, y) => drawTextCard(pdf, targetPage, c, x, y, fonts, ink));
  await drawNextCard((targetPage, x, y) => drawStateCard(pdf, targetPage, c, x, y, fonts, ink));
  const notePages = splitTextIntoCardPages(c.notes);
  for (let index = 0; index < notePages.length; index += 1) {
    await drawNextCard((targetPage, x, y) => drawLoreCard(targetPage, c, notePages[index], index, notePages.length, x, y, fonts, ink, "Notes"));
  }
  const linkedResources = await loadLinkedBundledResources(c);
  await appendLinkedResourcePages(pdf, linkedResources);
  await appendGeneratedBackPages(pdf, c, frontCount, inkHex);
  await attachCharacterPayload(pdf, c);
  await attachResourceBundle(pdf, linkedResources);
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
};

export const renderHeroCardsA6PdfFromElements = async (c: Character, cards: HTMLElement[], { includeBacks = true }: { includeBacks?: boolean } = {}): Promise<Blob> => {
  const pdf = await PDFDocument.create();
  const cssText = await collectStylesheetText();
  const addWhitePage = () => {
    const nextPage = pdf.addPage([A4_W, A4_H]);
    nextPage.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    return nextPage;
  };
  let page = addWhitePage();
  let slot = 0;

  const fronts = cards.filter(card => !card.classList.contains("hero-back-card"));
  const back = cards.find(card => card.classList.contains("hero-back-card"));
  for (const [cardIndex, card] of fronts.entries()) {
    reportExportProgress(10 + cardIndex / fronts.length * 45, `Cartes du héros ${cardIndex + 1}/${fronts.length}`);
    if (slot >= 4) {
      page = addWhitePage();
      slot = 0;
    }

    const x = slot % 2 === 0 ? 0 : A6_W;
    const y = slot < 2 ? A4_H - A6_H : A4_H - A6_H * 2;
    const pngBytes = await cardElementToPngBytes(card, cssText, c.cardInk);
    const image = await pdf.embedPng(pngBytes);
    page.drawImage(image, { x, y, width: A6_W, height: A6_H });
    slot += 1;
  }

  const linkedResources = await loadLinkedBundledResources(c);
  await exportRange(55, 80, () => appendLinkedResourcePages(pdf, linkedResources, includeBacks));
  if (includeBacks && back && fronts.length) {
    reportExportProgress(85, "Dos des cartes du héros…");
    const image = await pdf.embedPng(await cardElementToPngBytes(back, cssText, c.cardInk));
    await appendA6BackPages(pdf, fronts.length, (target, x, y) => target.drawImage(image, { x, y, width: A6_W, height: A6_H }));
  } else if (includeBacks) {
    await appendGeneratedBackPages(pdf, c, fronts.length, c.cardInk);
  }
  await attachCharacterPayload(pdf, c);
  await attachResourceBundle(pdf, linkedResources);
  reportExportProgress(95, "Assemblage du PDF A6…");
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
};

export const exportHeroCardsA6Pdf = async (c: Character, inkHex = "#3a1307", cards?: HTMLElement[]) => {
  let blob: Blob;
  if (cards?.length) {
    try {
      blob = await renderHeroCardsA6PdfFromElements(c, cards);
    } catch (error) {
      console.warn("Capture exacte des cartes impossible, export A6 genere en fallback.", error);
      blob = await renderHeroCardsA6Pdf(c, inkHex);
    }
  } else {
    blob = await renderHeroCardsA6Pdf(c, inkHex);
  }
  downloadBlob(blob, `${safeFileName(c.nom)}_cartes_A6.pdf`);
};
