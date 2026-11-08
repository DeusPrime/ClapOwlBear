import { measureCitationLines, drawCitation } from '@/lib/resourceCitation';
import { localizeText } from '@/i18n/localize';
import { renderResourceCardsPdf } from "./resourceCardsPdf";
import { migratePower } from "./powers";
import { parseJsonData, validateImportedResource } from "./dataValidation";
import caseLong from "@/assets/power-card/case-long.svg";
import caseShort from "@/assets/power-card/case-short.svg";
import type { Power } from "./powers";
import { readPngText, writePngText } from "./pngMeta";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToBlocks, richTextToPlainText, type RichTextRun } from "./richText";

const POWER_META_KEY = "clap-role-power";
const W = 744;
const H = 1039;
const BLUE = "#032C4D";
const CARD_CONTENT_BOTTOM = 1016;
const CARD_W_MM = 63;
const CARD_H_MM = 88;
const CARDS_PER_PAGE = 9;
const TITLE_TOP = 112;
const TITLE_WIDTH = 660;
const TITLE_DESCRIPTION_GAP = 21;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 62;
const TITLE_BASELINE_OFFSET = 35;
const TITLE_CHARS_PER_LINE = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_WIDTH = 650;
const DESCRIPTION_TEXT_TOP = 10;
const DESCRIPTION_VERTICAL_CHROME = 26;
const DESCRIPTION_CHARS_PER_LINE = 34;
const DESCRIPTION_MAX_BOTTOM = 970;
const DESCRIPTION_BASE_FONT_SIZE = 34;
const DESCRIPTION_BASE_LINE_HEIGHT = 39;
const POWER_TEXT_BASE_FONT_SIZE = 34;
const POWER_TEXT_BASE_LINE_HEIGHT = 39;
const POWER_SECTION_CHARS_PER_LINE = 31;
const MIN_TEXT_SCALE = 0.02;
const POWER_SECTION_BOTTOM_PADDING = 8;
const SPECIAL_FRAME_X = 42;
const SPECIAL_FRAME_WIDTH = 660;
const SPECIAL_TOP_DECOR_HEIGHT = 32;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 32;
const SPECIAL_FRAME_BOTTOM_GAP = 8;
const SPECIAL_CITATION_GAP = 8;
const SPECIAL_CITATION_BOTTOM_GAP = 0;
const CITATION_CHARS_PER_LINE = 33;
const SECTION_TITLE_MARKER_LEFT = 14;
const SECTION_TITLE_MARKER_TOP = 0;
const SECTION_TEXT_LEFT = 24;
const SECTION_TEXT_WIDTH = 612;

const POWER_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg width="17" height="35" viewBox="0 0 17 35" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.61949 17.9785L0 17.0927L5.48787 0H12.9906L8.73653 9.80672L16.3895 11.0116L2.34136 35L6.61949 17.9785Z" fill="white"/></svg>`)}`;

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawCoverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

const drawWhiteEdgeVignette = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  const edge = 86;
  const gradients = [
    [ctx.createLinearGradient(x, y, x + edge, y), x, y, edge, h],
    [ctx.createLinearGradient(x + w, y, x + w - edge, y), x + w - edge, y, edge, h],
    [ctx.createLinearGradient(x, y, x, y + edge), x, y, w, edge],
    [ctx.createLinearGradient(x, y + h, x, y + h - edge), x, y + h - edge, w, edge],
  ] as const;
  gradients.forEach(([gradient, gx, gy, gw, gh]) => {
    gradient.addColorStop(0, "rgba(255,255,255,0.92)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(gx, gy, gw, gh);
  });
};

const fitText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
  const lines: string[] = [];
  const push = (raw: string) => {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(localizeText(test)).width > maxWidth) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
  };
  text.replace(/\r\n/g, "\n").split("\n").forEach(push);
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(localizeText(line), x, y + index * lineHeight));
};

const setRichTextFont = (ctx: CanvasRenderingContext2D, run: RichTextRun, fontSize: number) => {
  ctx.font = `${run.italic ? "italic " : ""}${run.bold ? "700" : "400"} ${fontSize}px 'Courier Prime', monospace`;
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

  for (const block of richTextToBlocks(value)) {
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

const drawMarker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.beginPath();
  ctx.moveTo(x + 34, y);
  ctx.lineTo(x + 26.3387, y + 7.70667);
  ctx.lineTo(x + 19.04, y + 7.70667);
  ctx.lineTo(x + 9.06667, y + 17.68);
  ctx.lineTo(x + 9.06667, y + 24.9333);
  ctx.lineTo(x, y + 34);
  ctx.lineTo(x, y + 12.7387);
  ctx.lineTo(x + 13.4187, y);
  ctx.closePath();
  ctx.fill();
};

const drawTag = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, value: string, x: number, y: number, w: number) => {
  ctx.drawImage(img, x, y, w, 63);
  ctx.fillStyle = BLUE;
  ctx.font = "700 24px 'Courier Prime', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(localizeText(value), x + w / 2, y + 31.5);
  ctx.textBaseline = "alphabetic";
};

export const renderPowerCardCanvas = async (power: Power, outputWidth = W): Promise<HTMLCanvasElement> => {
  const [icon, shortCase, longCase] = await Promise.all([loadImg(POWER_ICON), loadImg(caseShort), loadImg(caseLong)]);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(H * outputWidth / W);
  const ctx = canvas.getContext("2d")!;
  if (outputWidth !== W) ctx.scale(outputWidth / W, outputWidth / W);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 30);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(18, 18, 708, 1003, 18);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(18, 18, 708, 1003, 18);
  ctx.clip();
  if (power.image) {
    try {
      const img = await loadImg(power.image);
      ctx.globalAlpha = 0.35;
      drawCoverImage(ctx, img, 18, 18, 708, 1003);
      ctx.globalAlpha = 1;
      drawWhiteEdgeVignette(ctx, 18, 18, 708, 1003);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(18, 18, 708, 1003);
    } catch {
      ctx.fillStyle = "#f3f8fb";
      ctx.fillRect(18, 18, 708, 1003);
    }
  }
  ctx.restore();

  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.moveTo(17, 17);
  ctx.lineTo(362, 17);
  ctx.lineTo(331, 91);
  ctx.lineTo(17, 91);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 5;
  ctx.setLineDash([1, 8]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(46, 26);
  ctx.lineTo(316, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(46, 82);
  ctx.lineTo(306, 82);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.drawImage(icon, 46, 38, 17, 35);
  ctx.fillStyle = "#fff";
  ctx.font = "700 34px 'Courier Prime', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(localizeText("Pouvoir"), 110, 56);
  ctx.textBaseline = "alphabetic";

  drawTag(ctx, shortCase, power.activation || "Actif", 372, 25, 129);
  drawTag(ctx, longCase, power.attribut || "Attribut", 511, 25, 206);

  const titleText = (power.titre || "Sans nom").toUpperCase();
  const specialText = richTextToPlainText(power.special);
  const hasSpecial = specialText.trim().length > 0;
  const limitationsText = richTextToPlainText(power.limitations);
  const hasLimitations = limitationsText.trim().length > 0;
  const hasPowerSections = hasSpecial || hasLimitations;
  const hasCitation = power.citation.trim().length > 0;

  const measureBodyLayout = (textScale: number) => {
    const titleLines = estimatePlainTextLines(titleText, Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const titleHeight = titleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const descriptionFontSize = DESCRIPTION_BASE_FONT_SIZE * textScale;
    const descriptionLineHeight = DESCRIPTION_BASE_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = power.description.trim() ? measurePlainTextLines(power.description, DESCRIPTION_TEXT_WIDTH, `italic 400 ${descriptionFontSize}px 'Courier Prime', monospace`) : 0;
    const descriptionHeight = descriptionLines * descriptionLineHeight + (power.description.trim() ? textClipSafety : 0);
    const descriptionBlockHeight = power.description.trim() ? descriptionHeight + DESCRIPTION_VERTICAL_CHROME : 0;
    const textLineHeight = POWER_TEXT_BASE_LINE_HEIGHT * textScale;
    const specialLines = hasSpecial ? measureRichTextLines(power.special, SECTION_TEXT_WIDTH, POWER_TEXT_BASE_FONT_SIZE * textScale) : 0;
    const limitationLines = hasLimitations ? measureRichTextLines(power.limitations, SECTION_TEXT_WIDTH, POWER_TEXT_BASE_FONT_SIZE * textScale) : 0;
    const sectionBodyHeight =
      (hasSpecial ? (specialLines + 1) * textLineHeight + specialClipSafety : 0) +
      (hasSpecial && hasLimitations ? 14 : 0) +
      (hasLimitations ? (limitationLines + 1) * textLineHeight + specialClipSafety : 0) +
      (hasPowerSections ? POWER_SECTION_BOTTOM_PADDING : 0);
    const specialFrameHeight = hasPowerSections
      ? SPECIAL_TOP_DECOR_HEIGHT + sectionBodyHeight + SPECIAL_FRAME_BOTTOM_GAP + SPECIAL_BOTTOM_DECOR_HEIGHT
      : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(`« ${power.citation} »`, SPECIAL_FRAME_WIDTH, `italic 700 ${descriptionFontSize}px 'Courier Prime', monospace`) : 0;
    const citationLines = hasCitation ? rawCitationLines : 0;
    const citationHeight = citationLines * descriptionLineHeight + (hasCitation ? citationClipSafety : 0);
    const citationTop = hasPowerSections ? specialFrameHeight + SPECIAL_CITATION_GAP : 0;
    const specialSectionHeight =
      (hasPowerSections ? specialFrameHeight : 0) +
      (hasCitation ? (hasPowerSections ? SPECIAL_CITATION_GAP : 0) + citationHeight + SPECIAL_CITATION_BOTTOM_GAP : 0);
    const specialTop = CARD_CONTENT_BOTTOM - specialSectionHeight;
    const descriptionMaxBottom = specialSectionHeight > 0 ? specialTop : DESCRIPTION_MAX_BOTTOM;
    const textBlockBottom = power.description.trim() ? descriptionTop + descriptionBlockHeight : TITLE_TOP + titleHeight;

    return {
      citationHeight,
      citationLines,
      citationTop,
      descriptionBlockHeight,
      descriptionFontSize,
      descriptionHeight,
      descriptionLineHeight,
      descriptionLines,
      descriptionTop,
      sectionBodyHeight,
      specialFrameHeight,
      specialLines,
      limitationLines,
      specialSectionHeight,
      specialTop,
      titleFontSize,
      titleLineHeight,
      titleLines,
      textFontSize: POWER_TEXT_BASE_FONT_SIZE * textScale,
      textLineHeight,
      fits: textBlockBottom <= descriptionMaxBottom,
    };
  };

  let bodyLayout = measureBodyLayout(1);
  if (!bodyLayout.fits) {
    let low = MIN_TEXT_SCALE;
    let high = 1;
    bodyLayout = measureBodyLayout(low);
    for (let index = 0; index < 22; index += 1) {
      const middle = (low + high) / 2;
      const candidate = measureBodyLayout(middle);
      if (candidate.fits) {
        low = middle;
        bodyLayout = candidate;
      } else {
        high = middle;
      }
    }
  }

  ctx.fillStyle = "#000";
  ctx.font = `700 ${bodyLayout.titleFontSize}px 'Courier Prime', monospace`;
  ctx.textAlign = "left";
  fitText(
    ctx,
    titleText,
    42,
    TITLE_TOP + bodyLayout.titleFontSize * (TITLE_BASELINE_OFFSET / TITLE_BASE_FONT_SIZE),
    TITLE_WIDTH,
    bodyLayout.titleLineHeight,
    bodyLayout.titleLines,
  );

  if (power.description.trim()) {

    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, bodyLayout.descriptionTop);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, bodyLayout.descriptionTop);
    ctx.stroke();
    ctx.fillStyle = BLUE;
    ctx.font = `italic 400 ${bodyLayout.descriptionFontSize}px 'Courier Prime', monospace`;
    fitText(
      ctx,
      power.description,
      42,
      bodyLayout.descriptionTop + DESCRIPTION_TEXT_TOP + bodyLayout.descriptionFontSize,
      DESCRIPTION_TEXT_WIDTH,
      bodyLayout.descriptionLineHeight,
      bodyLayout.descriptionLines,
    );
    ctx.beginPath();
    ctx.moveTo(42, bodyLayout.descriptionTop + bodyLayout.descriptionBlockHeight);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, bodyLayout.descriptionTop + bodyLayout.descriptionBlockHeight);
    ctx.stroke();
  }

  if (hasPowerSections) {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(SPECIAL_FRAME_X, bodyLayout.specialTop + 29);
    ctx.lineTo(SPECIAL_FRAME_X + 22, bodyLayout.specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 22, bodyLayout.specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH, bodyLayout.specialTop + 29);
    ctx.stroke();

    let cursorY = bodyLayout.specialTop + SPECIAL_TOP_DECOR_HEIGHT;
    const drawSectionTitle = (title: string) => {
      ctx.fillStyle = BLUE;
      ctx.textAlign = "left";
      ctx.font = `700 ${bodyLayout.textFontSize}px 'Courier Prime', monospace`;
      ctx.fillText(localizeText(title), SPECIAL_FRAME_X + SECTION_TEXT_LEFT, cursorY + bodyLayout.textFontSize);
      cursorY += bodyLayout.textLineHeight;
    };
    if (hasSpecial) {
      drawSectionTitle("Effet");
      ctx.fillStyle = BLUE;
      ctx.textAlign = "left";
      drawRichText(
        ctx,
        power.special,
        SPECIAL_FRAME_X + SECTION_TEXT_LEFT,
        cursorY + bodyLayout.textFontSize,
        SECTION_TEXT_WIDTH,
        bodyLayout.textLineHeight,
        bodyLayout.specialLines,
        bodyLayout.textFontSize,
      );
      cursorY += bodyLayout.specialLines * bodyLayout.textLineHeight;
    }
    if (hasSpecial && hasLimitations) cursorY += 14;
    if (hasLimitations) {
      drawSectionTitle("Limitation");
      ctx.fillStyle = BLUE;
      drawRichText(
        ctx,
        power.limitations,
        SPECIAL_FRAME_X + SECTION_TEXT_LEFT,
        cursorY + bodyLayout.textFontSize,
        SECTION_TEXT_WIDTH,
        bodyLayout.textLineHeight,
        bodyLayout.limitationLines,
        bodyLayout.textFontSize,
      );
    }

    ctx.beginPath();
    const specialBottomTop = bodyLayout.specialTop + SPECIAL_TOP_DECOR_HEIGHT + bodyLayout.sectionBodyHeight + SPECIAL_FRAME_BOTTOM_GAP;
    ctx.moveTo(SPECIAL_FRAME_X, specialBottomTop + 3);
    ctx.lineTo(SPECIAL_FRAME_X + 24, specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 24, specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH, specialBottomTop + 3);
    ctx.stroke();
  }

  if (hasCitation) {
    ctx.fillStyle = BLUE;
    ctx.font = `italic 700 ${bodyLayout.descriptionFontSize}px 'Courier Prime', monospace`;
    ctx.textAlign = "center";
    drawCitation(
      ctx,
      `« ${power.citation} »`,
      W / 2,
      bodyLayout.specialTop + bodyLayout.citationTop + bodyLayout.descriptionFontSize,
      SPECIAL_FRAME_WIDTH,
      bodyLayout.descriptionLineHeight,
);
  }

  return canvas;
};

export const renderPowerCardBlob = async (power: Power): Promise<Blob> => {
  const canvas = await renderPowerCardCanvas(power);
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};

export const exportPowerPng = async (power: Power): Promise<Blob> => {
  const blob = await renderPowerCardBlob(power);
  return writePngText(blob, POWER_META_KEY, JSON.stringify(power));
};

export const exportPowersA4Pdf = async (powers: Power[]): Promise<Blob> => {
  return renderResourceCardsPdf(powers, renderPowerCardBlob, false, "power");
};

export const importPowerPng = async (file: File): Promise<Power | null> => {
  const text = await readPngText(file, POWER_META_KEY);
  if (!text) return null;
  try {
    return migratePower(validateImportedResource("power", parseJsonData(text)));
  } catch {
    return null;
  }
};
