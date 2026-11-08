import { measureCitationLines, drawCitation } from '@/lib/resourceCitation';
import { drawFadedCardBackground } from "./fadedCardBackground";
import { localizeText } from '@/i18n/localize';
import { renderResourceCardsPdf } from "./resourceCardsPdf";
import { migrateKeyRole } from "./keyRoles";
import { parseJsonData, validateImportedResource } from "./dataValidation";
import { KeyRole } from "./keyRoles";
import { readPngText, writePngText } from "./pngMeta";
import caseAme from "@/assets/key-role-card/case-ame.svg";
import caseArmure from "@/assets/key-role-card/case-armure.svg";
import caseCorps from "@/assets/key-role-card/case-corps.svg";
import caseDegats from "@/assets/key-role-card/case-degats.svg";
import caseEsprit from "@/assets/key-role-card/case-esprit.svg";
import crownIcon from "@/assets/key-role-card/crown-icon.svg";
import heartPulseIcon from "@/assets/key-role-card/heart-pulse-icon.svg";
import iconAme from "@/assets/key-role-card/icone-ame.svg";
import iconArmure from "@/assets/key-role-card/icone-armure.svg";
import iconCorps from "@/assets/key-role-card/icone-corps.svg";
import iconDegats from "@/assets/key-role-card/icone-degats.svg";
import iconEsprit from "@/assets/key-role-card/icone-esprit.svg";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToBlocks, richTextToPlainText, type RichTextRun } from "./richText";

const W = 744;
const H = 1039;
const CARD_CONTENT_BOTTOM = 1026;
const CARD_FILL_X = 24;
const CARD_FILL_Y = 21;
const CARD_FILL_WIDTH = 711;
const CARD_FILL_HEIGHT = 1009;
const CARD_IMAGE_X = 33;
const CARD_IMAGE_Y = 30;
const CARD_IMAGE_WIDTH = 693;
const CARD_IMAGE_HEIGHT = 991;
const CARD_IMAGE_RADIUS = 12;
const CARD_BORDER_X = 15;
const CARD_BORDER_Y = 12;
const CARD_BORDER_WIDTH = 729;
const CARD_BORDER_HEIGHT = 1027;
const CARD_BORDER_LINE_WIDTH = 18;
const CARD_BORDER_RADIUS = 30;
const PV_X = 506;
const PV_Y = 43;
const PV_HEART_WIDTH = 36;
const PV_HEART_HEIGHT = 32;
const PV_GAP = 8;
const PV_TEXT_BASELINE = 82;
const ICON_TITLE_Y_OFFSET = -4;
const TITLE_WIDTH = 660;
const TITLE_TOP = 121;
const TITLE_DESCRIPTION_GAP = 20;
const TITLE_BASE_FONT_SIZE = 60;
const TITLE_BASE_LINE_HEIGHT = 67;
const TITLE_BASELINE_OFFSET = 47;
const TITLE_CHARS_PER_LINE = 18;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_TOP = 8;
const DESCRIPTION_VERTICAL_CHROME = 24;
const DESCRIPTION_STATS_GAP = 28;
const RED = "#570211";
const SPECIAL_INK = RED;
const SPECIAL_FRAME_X = 45;
const SPECIAL_FRAME_WIDTH = 668;
const SPECIAL_TITLE_MARKER_LEFT = 14;
const SPECIAL_TITLE_MARKER_TOP = 21;
const SPECIAL_TITLE_LEFT = 31;
const SPECIAL_TITLE_TOP = 29;
const SPECIAL_TEXT_LEFT = 20;
const SPECIAL_TEXT_TOP = 29;
const SPECIAL_TITLE_BASELINE = 52;
const SPECIAL_TEXT_BASELINE_OFFSET = 22;
const CITATION_TEXT_BASELINE_OFFSET = 20;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_CITATION_GAP = 3;
const SPECIAL_CITATION_BOTTOM_GAP = 4;
const SPECIAL_NO_CITATION_BOTTOM_GAP = 24;
const SINGLE_WEAPON_ATTRIBUTES_BOTTOM_OFFSET = 204;
const MULTI_WEAPON_ATTRIBUTES_BOTTOM_OFFSET = 204;
const MAX_WEAPONS = 4;
const DAMAGE_BOX_WIDTH = 97;
const DAMAGE_ROW_SLOT_WIDTH = 95;
const DAMAGE_ROW_LEFT = 342;
const DAMAGE_ROW_TOP_OFFSET = 121;
const HEADER_CONTENT_Y_OFFSET = -1;
const HEADER_CROWN_Y_OFFSET = -2;
const HEADER_TEXT_Y_OFFSET = -5;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const DESCRIPTION_CHARS_PER_LINE = 34;
const SPECIAL_CHARS_PER_LINE = 31;
const CITATION_CHARS_PER_LINE = 33;
const MIN_TEXT_SCALE = 0.02;
const SPECIAL_TITLE_BASELINE_RATIO = (SPECIAL_TITLE_BASELINE - SPECIAL_TITLE_TOP) / BASE_TEXT_FONT_SIZE;
const TEXT_BASELINE_RATIO = SPECIAL_TEXT_BASELINE_OFFSET / BASE_TEXT_FONT_SIZE;
const CITATION_BASELINE_RATIO = CITATION_TEXT_BASELINE_OFFSET / BASE_TEXT_FONT_SIZE;

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const fitText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
  const lines: string[] = [];
  const splitLongWord = (word: string) => {
    const parts: string[] = [];
    let part = "";
    for (const char of word) {
      const test = `${part}${char}`;
      if (part && ctx.measureText(localizeText(test)).width > maxWidth) {
        parts.push(part);
        part = char;
      } else {
        part = test;
      }
    }
    if (part) parts.push(part);
    return parts;
  };

  const pushWrappedLine = (rawLine: string) => {
    if (lines.length >= maxLines) return;
    const words = rawLine
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => (ctx.measureText(localizeText(word)).width > maxWidth ? splitLongWord(word) : [word]));
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(localizeText(test)).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
  };

  text.replace(/\r\n/g, "\n").split("\n").forEach(pushWrappedLine);
  lines.forEach((l, i) => ctx.fillText(localizeText(l), x, y + i * lineHeight));
};

const setRichTextFont = (ctx: CanvasRenderingContext2D, run: RichTextRun, fontSize: number) => {
  ctx.font = `${run.italic ? "italic " : ""}${run.bold ? "700" : "400"} ${fontSize}px 'Courier Prime', 'Courier New', monospace`;
};

const trimSegments = (segments: RichTextRun[]) => {
  const trimmed = segments.map((segment) => ({ ...segment }));
  while (trimmed.length && trimmed[0].text.trim() === "") trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1].text.trim() === "") trimmed.pop();
  return trimmed;
};

const drawRichLine = (ctx: CanvasRenderingContext2D, segments: RichTextRun[], x: number, y: number, fontSize: number) => {
  let cursor = x;
  trimSegments(segments).forEach((segment) => {
    setRichTextFont(ctx, segment, fontSize);
    ctx.fillText(localizeText(segment.text), cursor, y);
    const width = ctx.measureText(localizeText(segment.text)).width;
    if (segment.underline && segment.text.trim()) {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = Math.max(1, fontSize * 0.0625);
      ctx.beginPath();
      ctx.moveTo(cursor, y + fontSize * 0.125);
      ctx.lineTo(cursor + width, y + fontSize * 0.125);
      ctx.stroke();
      ctx.restore();
    }
    cursor += width;
  });
};

const drawRichText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  fontSize: number,
) => {
  let cursorY = y;
  let drawnLines = 0;

  const drawWrappedRuns = (runs: RichTextRun[]) => {
    let line: RichTextRun[] = [];
    let lineWidth = 0;

    const flushLine = () => {
      if (drawnLines >= maxLines || trimSegments(line).length === 0) return;
      drawRichLine(ctx, line, x, cursorY, fontSize);
      cursorY += lineHeight;
      drawnLines += 1;
      line = [];
      lineWidth = 0;
    };

    for (const run of runs) {
      const tokens = run.text.split(/(\s+)/).filter(Boolean);
      for (const token of tokens) {
        if (drawnLines >= maxLines) return;
        const isSpace = token.trim() === "";
        const segment = { ...run, text: token };
        setRichTextFont(ctx, segment, fontSize);
        const width = ctx.measureText(localizeText(token)).width;

        if (!isSpace && line.length > 0 && lineWidth + width > maxWidth) flushLine();
        if (isSpace && line.length === 0) continue;

        line.push(segment);
        lineWidth += width;
      }
    }

    flushLine();
  };

  for (const block of richTextToBlocks(value, { preserveLineBreaks: true })) {
    if (drawnLines >= maxLines) break;
    if (block.blank) {
      cursorY += lineHeight;
      drawnLines += 1;
      continue;
    }
    const prefix = block.listItem ? (block.listKind === "ol" ? `${block.listIndex ?? 1}. ` : "\u2022 ") : "";
    drawWrappedRuns(block.listItem ? [{ text: prefix, bold: true }, ...block.runs] : block.runs);
  }
};


const drawInImageFrame = (ctx: CanvasRenderingContext2D, draw: () => void) => {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(CARD_IMAGE_X, CARD_IMAGE_Y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT, CARD_IMAGE_RADIUS);
  ctx.clip();
  draw();
  ctx.restore();
};

const drawIconWithGlow = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) => {
  [
    { blur: 10, opacity: 0.36 },
    { blur: 6, opacity: 0.58 },
    { blur: 3, opacity: 0.82 },
  ].forEach(({ blur, opacity }) => {
    ctx.save();
    ctx.shadowColor = `rgba(255,255,255,${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(img, x, y, width, height);
    ctx.restore();
  });
  ctx.drawImage(img, x, y, width, height);
};

const drawValueBox = (ctx: CanvasRenderingContext2D, value: string, img: HTMLImageElement, x: number, y: number) => {
  ctx.drawImage(img, x, y, 97, 63);
  ctx.fillStyle = RED;
  ctx.font = "700 32px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "center";
  drawWithRoleGlow(ctx, () => ctx.fillText(localizeText(value || "-"), x + 48.5, y + 38));
};

const useRoleGlow = (ctx: CanvasRenderingContext2D, blur: number, opacity: number) => {
  ctx.shadowColor = `rgba(255,255,255,${opacity})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
};

const drawWithRoleGlow = (ctx: CanvasRenderingContext2D, draw: () => void) => {
  [
    { blur: 8, opacity: 0.28 },
    { blur: 5.2, opacity: 0.48 },
    { blur: 2.6, opacity: 0.72 },
  ].forEach(({ blur, opacity }) => {
    ctx.save();
    useRoleGlow(ctx, blur, opacity);
    draw();
    ctx.restore();
  });

  ctx.save();
  ctx.shadowBlur = 0;
  draw();
  ctx.restore();
};

const drawDamageTile = (ctx: CanvasRenderingContext2D, weaponName: string, value: string, img: HTMLImageElement, x: number, y: number) => {
  drawValueBox(ctx, value, img, x, y);
  ctx.fillStyle = RED;
  ctx.font = "700 16px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "center";
  drawWithRoleGlow(ctx, () => fitText(ctx, weaponName, x + DAMAGE_BOX_WIDTH / 2, y + 75, DAMAGE_BOX_WIDTH, 17, 2));
};

const drawStat = (
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  icon: HTMLImageElement,
  valueCase: HTMLImageElement,
) => {
  ctx.drawImage(icon, x - 3, y + 6 + ICON_TITLE_Y_OFFSET, 45, 45);
  ctx.fillStyle = RED;
  ctx.font = "700 32px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "left";
  drawWithRoleGlow(ctx, () => ctx.fillText(localizeText(`${label.toUpperCase()}:`), x + 40, y + 36));
  drawValueBox(ctx, value, valueCase, x + 183, y - 3);
};

// A4 at 300 DPI — card (W=744 × H=1039) ≈ 63×88 mm at 300 DPI (poker size).
const A4_PX_W = 2480;
const A4_PX_H = 3508;

export const renderKeyRoleCardCanvas = async (role: KeyRole, outputWidth = W): Promise<HTMLCanvasElement> => {
  const [
    crown,
    heart,
    corpsIcon,
    espritIcon,
    ameIcon,
    armureIcon,
    degatsIcon,
    corpsCase,
    espritCase,
    ameCase,
    armureCase,
    degatsCase,
  ] = await Promise.all([
    loadImg(crownIcon),
    loadImg(heartPulseIcon),
    loadImg(iconCorps),
    loadImg(iconEsprit),
    loadImg(iconAme),
    loadImg(iconArmure),
    loadImg(iconDegats),
    loadImg(caseCorps),
    loadImg(caseEsprit),
    loadImg(caseAme),
    loadImg(caseArmure),
    loadImg(caseDegats),
  ]);
  const hasDescription = role.description.trim().length > 0;
  const descriptionText = role.description;
  const weapons = (role.armes.length ? role.armes : [{ nom: "", degats: "" }]).slice(0, MAX_WEAPONS);
  const hasMultipleWeapons = weapons.length > 1;
  const attributesBottomOffset = hasMultipleWeapons ? MULTI_WEAPON_ATTRIBUTES_BOTTOM_OFFSET : SINGLE_WEAPON_ATTRIBUTES_BOTTOM_OFFSET;
  const hasSpecial = richTextToPlainText(role.special).trim().length > 0;
  const hasCitation = role.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((role.titre || "Sans nom").toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_TEXT_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(descriptionText, DESCRIPTION_WIDTH, `italic 400 ${fontSize}px 'Courier Prime', 'Courier New', monospace`) : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(role.citation, SPECIAL_FRAME_WIDTH, `italic 700 ${fontSize}px 'Courier Prime', 'Courier New', monospace`) : 0;
    const citationLines = hasCitation ? rawCitationLines : 0;
    const specialLines = hasSpecial
      ? measureRichTextLines(role.special, 630, fontSize, undefined, { preserveLineBreaks: true })
      : 0;
    const descriptionHeight = descriptionLines * lineHeight + (hasDescription ? textClipSafety : 0);
    const descriptionBlockHeight = hasDescription ? descriptionHeight + DESCRIPTION_VERTICAL_CHROME : 0;
    const statsTop = hasDescription ? descriptionTop + descriptionBlockHeight + DESCRIPTION_STATS_GAP : descriptionTop;
    const citationHeight = citationLines * lineHeight + (hasCitation ? citationClipSafety : 0);
    const specialHeight = specialLines * lineHeight + (hasSpecial ? specialClipSafety : 0);
    const specialBottomTop = SPECIAL_TEXT_TOP + specialHeight + SPECIAL_FRAME_BOTTOM_GAP;
    const specialFrameHeight = hasSpecial ? specialBottomTop + SPECIAL_BOTTOM_DECOR_HEIGHT : 0;
    const citationTop = hasSpecial ? specialFrameHeight + SPECIAL_CITATION_GAP : 0;
    const specialSectionHeight =
      (hasSpecial ? specialFrameHeight + (hasCitation ? 0 : SPECIAL_NO_CITATION_BOTTOM_GAP) : 0) +
      (hasCitation ? (hasSpecial ? SPECIAL_CITATION_GAP : 0) + citationHeight + SPECIAL_CITATION_BOTTOM_GAP : 0);

    return {
      citationHeight,
      citationLines,
      citationTop,
      descriptionBlockHeight,
      descriptionTop,
      descriptionHeight,
      descriptionLines,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialHeight,
      specialLines,
      specialSectionHeight,
      statsTop,
      titleFontSize,
      titleLineHeight,
      titleLines: rawTitleLines,
      fits: statsTop + attributesBottomOffset + specialSectionHeight <= CARD_CONTENT_BOTTOM,
    };
  };

  let textLayout = measureTextLayout(1);
  if (!textLayout.fits) {
    let low = MIN_TEXT_SCALE;
    let high = 1;
    textLayout = measureTextLayout(low);
    for (let index = 0; index < 22; index += 1) {
      const middle = (low + high) / 2;
      const candidate = measureTextLayout(middle);
      if (candidate.fits) {
        low = middle;
        textLayout = candidate;
      } else {
        high = middle;
      }
    }
  }

  const {
    citationHeight,
    citationLines,
    citationTop,
    descriptionBlockHeight,
    descriptionTop,
    descriptionLines,
    fontSize: textFontSize,
    lineHeight: textLineHeight,
    specialBottomTop,
    specialLines,
    specialSectionHeight,
    statsTop,
    titleFontSize,
    titleLineHeight,
    titleLines,
  } = textLayout;
  const specialTop = CARD_CONTENT_BOTTOM - specialSectionHeight;

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(H * outputWidth / W);
  const ctx = canvas.getContext("2d")!;
  if (outputWidth !== W) ctx.scale(outputWidth / W, outputWidth / W);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(CARD_FILL_X, CARD_FILL_Y, CARD_FILL_WIDTH, CARD_FILL_HEIGHT, 20);
  ctx.fill();

  if (role.image) {
    try {
      const img = await loadImg(role.image);
      drawInImageFrame(ctx, () => {
        drawFadedCardBackground(ctx, img, CARD_IMAGE_X, CARD_IMAGE_Y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);
      });
    } catch {
      ctx.fillStyle = "#eee";
      drawInImageFrame(ctx, () => ctx.fillRect(CARD_IMAGE_X, CARD_IMAGE_Y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT));
    }
  } else {
    ctx.fillStyle = "#eee";
    drawInImageFrame(ctx, () => {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(CARD_IMAGE_X, CARD_IMAGE_Y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(CARD_IMAGE_X, CARD_IMAGE_Y, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);
    });
  }

  ctx.strokeStyle = RED;
  ctx.lineWidth = CARD_BORDER_LINE_WIDTH;
  const borderInset = CARD_BORDER_LINE_WIDTH / 2;
  ctx.beginPath();
  ctx.roundRect(
    CARD_BORDER_X + borderInset,
    CARD_BORDER_Y + borderInset,
    CARD_BORDER_WIDTH - CARD_BORDER_LINE_WIDTH,
    CARD_BORDER_HEIGHT - CARD_BORDER_LINE_WIDTH,
    CARD_BORDER_RADIUS - borderInset,
  );
  ctx.stroke();

  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(32, 28);
  ctx.lineTo(397, 28);
  ctx.lineTo(368, 92);
  ctx.lineTo(32, 92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.setLineDash([1, 8]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(49, 33 + HEADER_CONTENT_Y_OFFSET);
  ctx.lineTo(358, 33 + HEADER_CONTENT_Y_OFFSET);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(49, 82 + HEADER_CONTENT_Y_OFFSET);
  ctx.lineTo(358, 82 + HEADER_CONTENT_Y_OFFSET);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  ctx.drawImage(crown, 56, 46 + HEADER_CONTENT_Y_OFFSET + HEADER_CROWN_Y_OFFSET, 37, 33);
  ctx.fillStyle = "#fff";
  ctx.font = "700 40px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(localizeText("Role cle"), 115, 76 + HEADER_CONTENT_Y_OFFSET + HEADER_TEXT_Y_OFFSET);

  ctx.fillStyle = RED;
  ctx.font = "700 32px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "left";
  drawIconWithGlow(ctx, heart, PV_X, PV_Y + (63 - PV_HEART_HEIGHT) / 2 + ICON_TITLE_Y_OFFSET, PV_HEART_WIDTH, PV_HEART_HEIGHT);
  const pvTextX = PV_X + PV_HEART_WIDTH + PV_GAP;
  drawWithRoleGlow(ctx, () => ctx.fillText(localizeText("PV:"), pvTextX, PV_TEXT_BASELINE));
  drawValueBox(ctx, role.pv, corpsCase, pvTextX + ctx.measureText(localizeText("PV:")).width + PV_GAP, PV_Y);

  ctx.fillStyle = "#000";
  ctx.font = `700 ${titleFontSize}px 'Courier Prime', 'Courier New', monospace`;
  ctx.textAlign = "left";
  drawWithRoleGlow(ctx, () =>
    fitText(
      ctx,
      (role.titre || "Sans nom").toUpperCase(),
      42,
      TITLE_TOP + titleFontSize * (TITLE_BASELINE_OFFSET / TITLE_BASE_FONT_SIZE),
      TITLE_WIDTH,
      titleLineHeight,
      titleLines,
    ),
  );

  if (hasDescription) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(42, descriptionTop);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, descriptionTop);
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.font = `italic 400 ${textFontSize}px 'Courier Prime', 'Courier New', monospace`;
    drawWithRoleGlow(ctx, () =>
      fitText(
        ctx,
        descriptionText,
        42,
        descriptionTop + DESCRIPTION_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
        DESCRIPTION_WIDTH,
        textLineHeight,
        descriptionLines,
      ),
    );
    ctx.beginPath();
    ctx.moveTo(42, descriptionTop + descriptionBlockHeight);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, descriptionTop + descriptionBlockHeight);
    ctx.stroke();
  }

  drawStat(ctx, "Corps", role.corps, 42, statsTop, corpsIcon, corpsCase);
  drawStat(ctx, "Esprit", role.esprit, 42, statsTop + 62, espritIcon, espritCase);
  drawStat(ctx, "Ame", role.ame, 42, statsTop + 124, ameIcon, ameCase);

  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(340, statsTop - 3);
  ctx.lineTo(340, statsTop - 3 + attributesBottomOffset);
  ctx.stroke();

  drawStat(ctx, "Armure", role.armure, 352, statsTop, armureIcon, armureCase);

  ctx.fillStyle = RED;
  ctx.font = "700 32px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.drawImage(degatsIcon, 349, statsTop + 68 + ICON_TITLE_Y_OFFSET, 45, 45);
  drawWithRoleGlow(ctx, () => ctx.fillText(localizeText("DEGATS:"), 392, statsTop + 98));
  if (hasMultipleWeapons) {
    const damageRowLeft = DAMAGE_ROW_LEFT + ((MAX_WEAPONS - weapons.length) * DAMAGE_ROW_SLOT_WIDTH) / 2;
    weapons.forEach((weapon, index) => {
      drawDamageTile(
        ctx,
        weapon.nom,
        weapon.degats,
        degatsCase,
        damageRowLeft + index * DAMAGE_ROW_SLOT_WIDTH,
        statsTop + DAMAGE_ROW_TOP_OFFSET,
      );
    });
  } else {
    const weapon = weapons[0];
    drawValueBox(ctx, weapon.degats, degatsCase, 535, statsTop + 59);
    ctx.font = "700 20px 'Courier Prime', 'Courier New', monospace";
    ctx.textAlign = "center";
    drawWithRoleGlow(ctx, () => fitText(ctx, weapon.nom, 583, statsTop + 136, 97, 22, 2));
  }

  if (hasSpecial) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = SPECIAL_INK;
    ctx.lineWidth = 6;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(SPECIAL_FRAME_X + 2, specialTop + 29);
    ctx.lineTo(SPECIAL_FRAME_X + 22, specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 22, specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 2, specialTop + 29);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(SPECIAL_FRAME_X + 2, specialTop + specialBottomTop + 3);
    ctx.lineTo(SPECIAL_FRAME_X + 24, specialTop + specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 24, specialTop + specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 2, specialTop + specialBottomTop + 3);
    ctx.stroke();

    ctx.fillStyle = SPECIAL_INK;
    const markerScale = textFontSize / BASE_TEXT_FONT_SIZE;
    ctx.font = `700 ${textFontSize}px 'Courier Prime', 'Courier New', monospace`;
    ctx.textAlign = "left";
    drawWithRoleGlow(ctx, () =>
      ctx.fillText(
        localizeText(""),
        SPECIAL_FRAME_X + SPECIAL_TITLE_LEFT,
        specialTop + SPECIAL_TITLE_TOP + textFontSize * SPECIAL_TITLE_BASELINE_RATIO,
      ),
    );
    drawWithRoleGlow(ctx, () =>
      drawRichText(
        ctx,
        role.special,
        SPECIAL_FRAME_X + SPECIAL_TEXT_LEFT,
        specialTop + SPECIAL_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
        630,
        textLineHeight,
        specialLines,
        textFontSize,
      ),
    );
  }

  if (hasCitation) {
    ctx.fillStyle = SPECIAL_INK;
    ctx.font = `italic 700 ${textFontSize}px 'Courier Prime', 'Courier New', monospace`;
    ctx.textAlign = "center";
    drawWithRoleGlow(ctx, () =>
      drawCitation(
        ctx,
        role.citation,
        SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH / 2,
        specialTop + citationTop + textFontSize * CITATION_BASELINE_RATIO,
        SPECIAL_FRAME_WIDTH,
        textLineHeight,
),
    );
  }
  ctx.shadowBlur = 0;

  return canvas;
};

export const renderKeyRoleCardBlob = async (role: KeyRole): Promise<Blob> => {
  const canvas = await renderKeyRoleCardCanvas(role);
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
};

export const exportKeyRolePng = async (role: KeyRole): Promise<Blob> => {
  const card = await renderKeyRoleCardCanvas(role);
  const blob: Blob = await new Promise((resolve) => card.toBlob((b) => resolve(b!), "image/png"));
  return writePngText(blob, "clap-role-key-role", JSON.stringify(role));
};

export const exportKeyRolesA4Pdf = async (roles: KeyRole[]): Promise<Blob> => {
  return renderResourceCardsPdf(roles, renderKeyRoleCardBlob, false, "key-role");
};

export const importKeyRolePng = async (file: File): Promise<KeyRole | null> => {
  const text = await readPngText(file, "clap-role-key-role");
  if (!text) return null;
  try {
    return migrateKeyRole(validateImportedResource("key-role", parseJsonData(text)));
  } catch {
    return null;
  }
};
