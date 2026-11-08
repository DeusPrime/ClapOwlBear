import { measureCitationLines, drawCitation } from '@/lib/resourceCitation';
import { drawFadedCardBackground } from "./fadedCardBackground";
import { localizeText } from '@/i18n/localize';
import { renderResourceCardsPdf } from "./resourceCardsPdf";
import { migrateFigurant } from "./figurants";
import { parseJsonData, validateImportedResource } from "./dataValidation";
import { Figurant } from "./figurants";
import { readPngText, writePngText } from "./pngMeta";
import figurantCase from "@/assets/figurant-card/case.svg";
import iconArmureSvg from "@/assets/key-role-card/icone-armure.svg?raw";
import iconCorpsSvg from "@/assets/key-role-card/icone-corps.svg?raw";
import iconDegatsSvg from "@/assets/key-role-card/icone-degats.svg?raw";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToBlocks, richTextToPlainText, type RichTextRun } from "./richText";

const W = 744;
const H = 1039;
const BROWN = "#3a1b0c";
const FIGURANT_HEADER_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg width="30" height="27" viewBox="0 0 30 27" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.6927 6.45063C21.9365 6.89259 23.2442 7.01146 24.6133 6.81029C24.949 6.76153 25.2777 6.70361 25.5969 6.64875C27.1245 6.39272 28.4013 6.24642 28.8553 7.72164C29.6569 10.3277 27.8433 15.9725 26.888 18.2555C24.9207 22.9585 21.0001 28.2194 16.4648 26.6588C15.7578 26.415 15.1217 26.0187 14.5542 25.4823C16.0439 24.4124 17.2215 22.7696 18.1319 20.8371L18.1295 20.8432C19.2574 20.9225 20.4303 21.6906 21.5038 22.5013C21.5818 20.6756 20.2127 19.4625 18.9926 18.7066C19.9715 15.875 20.4894 12.696 20.6502 9.85828C20.6975 8.98046 20.7235 7.7826 20.6927 6.45063ZM0.61729 1.98533C0.986168 1.53423 1.54421 1.41535 2.17793 1.46717C3.36732 1.56166 4.59691 2.0341 5.75084 2.43643C8.25968 3.30816 10.7141 3.02469 13.1047 1.60128C13.4263 1.40926 13.7408 1.21114 14.0459 1.02216C15.5024 0.113864 16.7415 -0.578029 17.5715 0.702126C19.0399 2.96373 18.6781 9.3706 18.3116 12.0559C17.5549 17.588 14.9941 24.513 10.0639 24.8879C7.44862 25.086 5.2188 23.1902 3.29875 19.6088C2.07625 17.1704 1.19425 14.665 0.655124 12.0894C0.267329 10.2118 -0.581562 3.45751 0.61729 1.98533ZM3.05992 10.4557C2.60828 10.3033 2.34818 10.1143 2.26069 9.89181C1.91309 9.0018 4.78135 6.75543 6.80545 8.81892C9.68317 11.7054 4.08143 10.8458 3.05992 10.4557ZM7.71582 19.1394C6.95205 18.4353 6.54298 17.5666 6.32071 16.3901C8.84373 18.036 11.206 17.9172 13.405 15.6525C13.3176 16.6553 13.0645 17.5545 12.6295 18.3439C11.3455 20.6756 9.46799 20.7518 7.71582 19.1394ZM15.8595 9.16334C16.2828 8.90731 16.5121 8.66042 16.5665 8.41963C16.7841 7.46256 13.6462 5.92333 11.9461 8.42878C9.52238 11.9431 14.9113 9.78513 15.8595 9.16334ZM21.4754 12.824C22.6672 11.5926 24.2988 11.8425 25.4338 13.0465C25.7223 13.3543 26.5144 14.2504 26.058 14.7412C25.9327 14.8753 25.7246 14.9515 25.4361 14.9698C24.7315 15.0734 23.7052 14.8844 22.8871 14.4486C22.2439 14.1133 21.7568 13.6652 21.4754 12.824Z" fill="white"/></svg>`)}`;
const roleIconDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replaceAll("#570211", BROWN))}`;
const iconArmure = roleIconDataUrl(iconArmureSvg);
const iconCorps = roleIconDataUrl(iconCorpsSvg);
const iconDegats = roleIconDataUrl(iconDegatsSvg);
const CARD_W_MM = 63;
const CARD_H_MM = 88;
const CARD_CONTENT_BOTTOM = 1016;
const HEADER_X = 16;
const HEADER_Y = 17;
const STAT_ICON_Y_OFFSET = 4;
const STAT_LABEL_BASELINE_OFFSET = 35;
const VALUE_BOX_X = 303;
const VALUE_BOX_WIDTH = 97;
const VALUE_BOX_HEIGHT = 63;
const STAT_ROW_STEP = 72;
const DAMAGE_ROW_Y_OFFSET = 144;
const DAMAGE_BOX_STEP = 105;
const WEAPON_LABEL_BASELINE_OFFSET = 75;
const TITLE_WIDTH = 660;
const TITLE_TOP = 112;
const TITLE_DESCRIPTION_GAP = 36;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 62;
const TITLE_BASELINE_OFFSET = 33;
const TITLE_CHARS_PER_LINE = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_WIDTH = 650;
const DESCRIPTION_TEXT_TOP = 10;
const DESCRIPTION_VERTICAL_CHROME = 26;
const DESCRIPTION_STATS_GAP = 20;
const STATS_BLOCK_HEIGHT = 251;
const SPECIAL_FRAME_X = 42;
const SPECIAL_FRAME_WIDTH = 660;
const SPECIAL_TITLE_MARKER_LEFT = 14;
const SPECIAL_TITLE_MARKER_TOP = 25;
const SPECIAL_TITLE_LEFT = 30;
const SPECIAL_TITLE_TOP = 29;
const SPECIAL_TEXT_LEFT = 24;
const SPECIAL_TEXT_TOP = 35;
const SPECIAL_TITLE_BASELINE = 51;
const SPECIAL_TEXT_BASELINE_OFFSET = 22;
const CITATION_TEXT_BASELINE_OFFSET = 20;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_CITATION_GAP = 4;
const SPECIAL_CITATION_BOTTOM_GAP = 0;
const CITATION_SEPARATOR_GAP = 8;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const DESCRIPTION_CHARS_PER_LINE = 34;
const SPECIAL_CHARS_PER_LINE = 34;
const CITATION_CHARS_PER_LINE = 32;
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
    const words = rawLine.split(/\s+/).filter(Boolean);
    const wrappedWords = words.flatMap((word) => (ctx.measureText(localizeText(word)).width > maxWidth ? splitLongWord(word) : [word]));
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    for (const word of wrappedWords) {
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
  lines.forEach((item, index) => ctx.fillText(localizeText(item), x, y + index * lineHeight));
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

const drawWithGlow = (ctx: CanvasRenderingContext2D, draw: () => void) => {
  [
    { blur: 8, opacity: 0.28 },
    { blur: 5.2, opacity: 0.48 },
    { blur: 2.6, opacity: 0.72 },
  ].forEach(({ blur, opacity }) => {
    ctx.shadowColor = `rgba(255,255,255,${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    draw();
  });
  ctx.shadowBlur = 0;
  draw();
};

const drawIconWithGlow = (ctx: CanvasRenderingContext2D, draw: () => void) => {
  [
    { blur: 10, opacity: 0.36 },
    { blur: 6, opacity: 0.58 },
    { blur: 3, opacity: 0.82 },
  ].forEach(({ blur, opacity }) => {
    ctx.shadowColor = `rgba(255,255,255,${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    draw();
  });
  ctx.shadowBlur = 0;
  draw();
};

const drawValueBox = (ctx: CanvasRenderingContext2D, boxImage: HTMLImageElement, x: number, y: number, value: string) => {
  ctx.drawImage(boxImage, x, y, VALUE_BOX_WIDTH, VALUE_BOX_HEIGHT);
  ctx.fillStyle = BROWN;
  ctx.font = "700 30px 'Courier Prime', monospace";
  ctx.textAlign = "center";
  drawWithGlow(ctx, () => ctx.fillText(localizeText(value || "-"), x + VALUE_BOX_WIDTH / 2, y + 38));
};

const drawWeaponLabel = (ctx: CanvasRenderingContext2D, name: string, x: number, y: number) => {
  if (!name.trim()) return;
  ctx.fillStyle = BROWN;
  ctx.font = "700 16px 'Courier Prime', monospace";
  ctx.textAlign = "center";
  drawWithGlow(ctx, () => fitText(ctx, name, x + VALUE_BOX_WIDTH / 2, y + WEAPON_LABEL_BASELINE_OFFSET, VALUE_BOX_WIDTH, 17, 2));
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

export const renderFigurantCardCanvas = async (figurant: Figurant, outputWidth = W): Promise<HTMLCanvasElement> => {
  const [headerIcon, corpsIcon, armureIcon, degatsIcon, valueBoxImage] = await Promise.all([
    loadImg(FIGURANT_HEADER_ICON),
    loadImg(iconCorps),
    loadImg(iconArmure),
    loadImg(iconDegats),
    loadImg(figurantCase),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(H * outputWidth / W);
  const ctx = canvas.getContext("2d")!;
  if (outputWidth !== W) ctx.scale(outputWidth / W, outputWidth / W);
  const weapons = (figurant.armes.length ? figurant.armes : [{ nom: "", degats: "" }]).slice(0, 4);
  const hasDescription = figurant.description.trim().length > 0;
  const hasSpecial = richTextToPlainText(figurant.special).trim().length > 0;
  const hasCitation = figurant.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((figurant.titre || "Sans nom").toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_TEXT_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(figurant.description, DESCRIPTION_TEXT_WIDTH, `italic 400 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const specialLines = hasSpecial ? measureRichTextLines(figurant.special, 612, fontSize) : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(figurant.citation, SPECIAL_FRAME_WIDTH, `italic 700 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const citationLines = hasCitation ? rawCitationLines : 0;
    const descriptionHeight = descriptionLines * lineHeight + (hasDescription ? textClipSafety : 0);
    const descriptionBlockHeight = hasDescription ? descriptionHeight + DESCRIPTION_VERTICAL_CHROME : 0;
    const statsTop = hasDescription ? descriptionTop + descriptionBlockHeight + DESCRIPTION_STATS_GAP : descriptionTop;
    const specialHeight = specialLines * lineHeight + (hasSpecial ? specialClipSafety : 0);
    const specialBottomTop = SPECIAL_TEXT_TOP + specialHeight + SPECIAL_FRAME_BOTTOM_GAP;
    const specialFrameHeight = hasSpecial ? specialBottomTop + SPECIAL_BOTTOM_DECOR_HEIGHT : 0;
    const citationHeight = citationLines * lineHeight + (hasCitation ? citationClipSafety : 0);
    const citationTop = hasSpecial ? specialFrameHeight + SPECIAL_CITATION_GAP : CITATION_SEPARATOR_GAP;
    const specialSectionHeight =
      (hasSpecial ? specialFrameHeight : 0) +
      (hasCitation ? (hasSpecial ? SPECIAL_CITATION_GAP : CITATION_SEPARATOR_GAP) + citationHeight + SPECIAL_CITATION_BOTTOM_GAP : 0);

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
      fits: statsTop + STATS_BLOCK_HEIGHT + specialSectionHeight <= CARD_CONTENT_BOTTOM,
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

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BROWN;
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
  if (figurant.image) {
    try {
      const img = await loadImg(figurant.image);
      drawFadedCardBackground(ctx, img, 18, 18, 708, 1003);
    } catch {
      ctx.fillStyle = "#eee";
      ctx.fillRect(18, 18, 708, 1003);
    }
  }
  ctx.restore();

  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.moveTo(HEADER_X, HEADER_Y);
  ctx.lineTo(HEADER_X + 365, HEADER_Y);
  ctx.lineTo(HEADER_X + 330, HEADER_Y + 70);
  ctx.lineTo(HEADER_X, HEADER_Y + 70);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 5;
  ctx.setLineDash([1, 8]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(HEADER_X + 36, HEADER_Y + 7);
  ctx.lineTo(HEADER_X + 312, HEADER_Y + 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(HEADER_X + 36, HEADER_Y + 60);
  ctx.lineTo(HEADER_X + 304, HEADER_Y + 60);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.font = "700 34px 'Courier Prime', monospace";
  ctx.textAlign = "center";
  ctx.fillText(localizeText("Figurant"), HEADER_X + 172, HEADER_Y + 43);
  ctx.drawImage(headerIcon, HEADER_X + 26, HEADER_Y + 16, 36, 32);

  ctx.fillStyle = "#000";
  ctx.font = `700 ${titleFontSize}px 'Courier Prime', monospace`;
  ctx.textAlign = "left";
  drawWithGlow(ctx, () =>
    fitText(
      ctx,
      (figurant.titre || "Sans nom").toUpperCase(),
      42,
      TITLE_TOP + titleFontSize * (TITLE_BASELINE_OFFSET / TITLE_BASE_FONT_SIZE),
      TITLE_WIDTH,
      titleLineHeight,
      titleLines,
    ),
  );

  if (hasDescription) {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, descriptionTop);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, descriptionTop);
    ctx.stroke();
    ctx.fillStyle = BROWN;
    ctx.font = `italic 400 ${textFontSize}px 'Courier Prime', monospace`;
    drawWithGlow(ctx, () =>
      fitText(
        ctx,
        figurant.description,
        42,
        descriptionTop + DESCRIPTION_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
        DESCRIPTION_TEXT_WIDTH,
        textLineHeight,
        descriptionLines,
      ),
    );
    ctx.beginPath();
    ctx.moveTo(42, descriptionTop + descriptionBlockHeight);
    ctx.lineTo(42 + DESCRIPTION_WIDTH, descriptionTop + descriptionBlockHeight);
    ctx.stroke();
  }

  ctx.fillStyle = BROWN;
  ctx.font = "700 32px 'Courier Prime', monospace";
  ctx.textAlign = "left";
  const statY = statsTop;
  [["", "POTENTIEL:", figurant.potentiel], ["", "ARMURE:", figurant.armure]].forEach(([icon, label, value], index) => {
    const y = statY + index * STAT_ROW_STEP;
    ctx.textAlign = "left";
    if (label === "ARMURE:") {
      ctx.drawImage(armureIcon, 39, y + STAT_ICON_Y_OFFSET, 45, 45);
    } else if (label === "POTENTIEL:") {
      ctx.drawImage(corpsIcon, 39, y + STAT_ICON_Y_OFFSET, 45, 45);
    } else {
      drawIconWithGlow(ctx, () => ctx.fillText(localizeText(icon), 42, y + 36));
    }
    drawWithGlow(ctx, () => ctx.fillText(localizeText(label), 90, y + STAT_LABEL_BASELINE_OFFSET));
    drawValueBox(ctx, valueBoxImage, VALUE_BOX_X, y, value);
  });
  const damageY = statY + DAMAGE_ROW_Y_OFFSET;
  ctx.textAlign = "left";
  ctx.drawImage(degatsIcon, 39, damageY + STAT_ICON_Y_OFFSET, 45, 45);
  drawWithGlow(ctx, () => ctx.fillText(localizeText("DEGATS:"), 90, damageY + STAT_LABEL_BASELINE_OFFSET));
  weapons.forEach((weapon, index) => {
    const x = VALUE_BOX_X + index * DAMAGE_BOX_STEP;
    drawValueBox(ctx, valueBoxImage, x, damageY, weapon.degats);
    drawWeaponLabel(ctx, weapon.nom, x, damageY);
  });

  if (hasSpecial) {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(SPECIAL_FRAME_X, specialTop + 29);
    ctx.lineTo(SPECIAL_FRAME_X + 20, specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 20, specialTop + 8);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH, specialTop + 29);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(SPECIAL_FRAME_X, specialTop + specialBottomTop + 3);
    ctx.lineTo(SPECIAL_FRAME_X + 24, specialTop + specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 24, specialTop + specialBottomTop + 23);
    ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH, specialTop + specialBottomTop + 3);
    ctx.stroke();
    ctx.fillStyle = BROWN;
    const markerScale = textFontSize / BASE_TEXT_FONT_SIZE;
    ctx.font = `700 ${textFontSize}px 'Courier Prime', monospace`;
    ctx.textAlign = "left";
    drawWithGlow(ctx, () =>
      ctx.fillText(
        localizeText(""),
        SPECIAL_FRAME_X + SPECIAL_TITLE_LEFT,
        specialTop + SPECIAL_TITLE_TOP + textFontSize * SPECIAL_TITLE_BASELINE_RATIO,
      ),
    );
    drawWithGlow(ctx, () =>
      drawRichText(
        ctx,
        figurant.special,
        SPECIAL_FRAME_X + SPECIAL_TEXT_LEFT,
        specialTop + SPECIAL_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
        SPECIAL_FRAME_WIDTH - SPECIAL_TEXT_LEFT * 2,
        textLineHeight,
        specialLines,
        textFontSize,
      ),
    );
  }

  if (hasCitation) {
    if (!hasSpecial) {
      ctx.strokeStyle = BROWN;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SPECIAL_FRAME_X + 20, specialTop + citationTop - 5);
      ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 20, specialTop + citationTop - 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = BROWN;
    ctx.font = `italic 700 ${textFontSize}px 'Courier Prime', monospace`;
    ctx.textAlign = "center";
    drawWithGlow(ctx, () =>
      drawCitation(
        ctx,
        figurant.citation,
        SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH / 2,
        specialTop + citationTop + textFontSize * CITATION_BASELINE_RATIO,
        SPECIAL_FRAME_WIDTH,
        textLineHeight,
),
    );
  }

  return canvas;
};

export const renderFigurantCardBlob = async (figurant: Figurant): Promise<Blob> => {
  const canvas = await renderFigurantCardCanvas(figurant);
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};

export const exportFigurantPng = async (figurant: Figurant): Promise<Blob> => {
  const blob = await renderFigurantCardBlob(figurant);
  return writePngText(blob, "clap-role-figurant", JSON.stringify(figurant));
};

export const exportFigurantsA4Pdf = async (figurants: Figurant[]): Promise<Blob> => {
  return renderResourceCardsPdf(figurants, renderFigurantCardBlob, false, "figurant");
};

export const importFigurantPng = async (file: File): Promise<Figurant | null> => {
  const text = await readPngText(file, "clap-role-figurant");
  if (!text) return null;
  try {
    return migrateFigurant(validateImportedResource("figurant", parseJsonData(text)));
  } catch {
    return null;
  }
};
