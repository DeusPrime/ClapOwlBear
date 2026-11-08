import { measureCitationLines, drawCitation } from '@/lib/resourceCitation';
import { localizeText } from '@/i18n/localize';
import { migrateProfile } from "./profiles";
import { parseJsonData, validateImportedResource } from "./dataValidation";
import facetIcon from "@/assets/profile-card/icone-facette.svg";
import traitsIcon from "@/assets/profile-card/icone-traits.svg";
import { Profile } from "./profiles";
import { readPngText, writePngText } from "./pngMeta";
import { estimatePlainTextLines, measurePlainTextLines } from "./richText";

const GREEN = "#005045";
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const CARD_CONTENT_BOTTOM = 1016;
const HEADER_X = 16;
const HEADER_Y = 17;
const TITLE_TOP = 112;
const TITLE_WIDTH = 610;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 60;
const TITLE_CHARS_PER_LINE = 20;
const TITLE_DESCRIPTION_GAP = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_TOP = 14;
const DESCRIPTION_VERTICAL_CHROME = 28;
const DESCRIPTION_STATS_GAP = 20;
const STATS_BLOCK_HEIGHT = 179;
const SPECIAL_FRAME_X = 42;
const SPECIAL_FRAME_WIDTH = 660;
const SPECIAL_TITLE_MARKER_LEFT = 14;
const SPECIAL_TITLE_MARKER_TOP = 25;
const SPECIAL_TITLE_LEFT = 30;
const SPECIAL_TITLE_TOP = 35;
const SPECIAL_TEXT_LEFT = 24;
const SPECIAL_TEXT_TOP = 35;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_CITATION_GAP = 4;
const SPECIAL_CITATION_BOTTOM_GAP = 0;
const CITATION_SEPARATOR_GAP = 8;
const SPECIAL_CHARS_PER_LINE = 34;
const CITATION_CHARS_PER_LINE = 32;
const DESCRIPTION_CHARS_PER_LINE = 34;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const MIN_TEXT_SCALE = 0.02;

const PROFILE_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="white" stroke-width="2"/>
  <path d="M9 7h6" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 17c.45-2.15 1.82-3.2 4-3.2s3.55 1.05 4 3.2" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="11" r="2.2" fill="white"/>
</svg>
`)}`;

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wrapText = (text: string, charsPerLine: number, maxLines = Number.MAX_SAFE_INTEGER) => {
  const safeCharsPerLine = Math.max(1, charsPerLine);
  const output: string[] = [];
  const pushBrokenWord = (word: string) => {
    for (let index = 0; index < word.length; index += safeCharsPerLine) {
      output.push(word.slice(index, index + safeCharsPerLine));
      if (output.length >= maxLines) return;
    }
  };

  (text || "").replace(/\r\n/g, "\n").split("\n").forEach((paragraph) => {
    if (output.length >= maxLines) return;
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      if (output.length >= maxLines) return;
      if (word.length > safeCharsPerLine) {
        if (line) {
          output.push(line);
          line = "";
        }
        pushBrokenWord(word);
        return;
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length > safeCharsPerLine && line) {
        output.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line && output.length < maxLines) output.push(line);
  });
  return output.slice(0, maxLines);
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawCoverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
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

const drawOctBox = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number) => {
  const w = 92;
  const h = 56;
  const points = [
    [x + w * 0.16, y],
    [x + w * 0.84, y],
    [x + w, y + h * 0.28],
    [x + w, y + h * 0.72],
    [x + w * 0.84, y + h],
    [x + w * 0.16, y + h],
    [x, y + h * 0.72],
    [x, y + h * 0.28],
  ];

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  points.forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  points
    .map(([px, py]) => [x + 6 + (px - x) * ((w - 12) / w), y + 6 + (py - y) * ((h - 12) / h)])
    .forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = GREEN;
  ctx.font = "bold 30px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(localizeText(value || "-"), x + w / 2, y + h / 2 + 2);
};

const drawTextLines = (
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxWidth = width,
) => {
  lines.forEach((line, index) => {
    ctx.fillText(localizeText(line), x, y + index * lineHeight, maxWidth);
  });
};

const facetLabel = (label: string, fallback: string) => label.trim() || fallback;

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

export const renderProfileCardCanvas = async (profile: Profile, outputWidth = CARD_WIDTH): Promise<HTMLCanvasElement> => {
  const profileIcon = await loadImg(PROFILE_ICON);
  const hasDescription = profile.description.trim().length > 0;
  const hasSpecial = profile.special.trim().length > 0;
  const hasCitation = profile.citation.trim().length > 0;
  const titleText = (profile.titre || "Sans nom").toUpperCase();

  const measureTextLayout = (textScale: number) => {
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines(titleText, Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_TEXT_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(profile.description, DESCRIPTION_WIDTH, `italic 400 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const specialLines = hasSpecial ? measurePlainTextLines(profile.special, 612, `400 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(profile.citation, SPECIAL_FRAME_WIDTH, `italic 700 ${fontSize}px 'Courier Prime', monospace`) : 0;
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
    const specialTop = CARD_CONTENT_BOTTOM - specialSectionHeight;
    return {
      citationHeight,
      citationTop,
      descriptionBlockHeight,
      descriptionHeight,
      descriptionTop,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialHeight,
      specialSectionHeight,
      specialTop,
      statsTop,
      titleFontSize: TITLE_BASE_FONT_SIZE * textScale,
      titleHeight,
      titleLineHeight,
      fits: statsTop + STATS_BLOCK_HEIGHT <= specialTop,
    };
  };

  let layout = measureTextLayout(1);
  if (!layout.fits) {
    let low = MIN_TEXT_SCALE;
    let high = 1;
    layout = measureTextLayout(low);
    for (let index = 0; index < 22; index += 1) {
      const middle = (low + high) / 2;
      const candidate = measureTextLayout(middle);
      if (candidate.fits) {
        low = middle;
        layout = candidate;
      } else {
        high = middle;
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(CARD_HEIGHT * outputWidth / CARD_WIDTH);
  const ctx = canvas.getContext("2d")!;
  if (outputWidth !== CARD_WIDTH) ctx.scale(outputWidth / CARD_WIDTH, outputWidth / CARD_WIDTH);

  ctx.fillStyle = GREEN;
  roundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 30);
  ctx.fill();

  ctx.fillStyle = "#fff";
  roundedRect(ctx, 17, 17, 710, 1005, 18);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 17, 17, 710, 1005, 18);
  ctx.clip();
  if (profile.image) {
    try {
      drawCoverImage(ctx, await loadImg(profile.image), 17, 17, 710, 1005);
      drawWhiteEdgeVignette(ctx, 17, 17, 710, 1005);
      ctx.fillStyle = "rgba(255,255,255,0.755)";
      ctx.fillRect(17, 17, 710, 1005);
    } catch {
      ctx.fillStyle = "#f3eee5";
      ctx.fillRect(17, 17, 710, 1005);
    }
  } else {
    const gradient = ctx.createRadialGradient(507, 218, 30, 507, 218, 360);
    gradient.addColorStop(0, "rgba(235,123,72,0.36)");
    gradient.addColorStop(0.42, "rgba(237,126,74,0.22)");
    gradient.addColorStop(1, "rgba(255,255,255,0.45)");
    ctx.fillStyle = gradient;
    ctx.fillRect(17, 17, 710, 1005);
    ctx.fillStyle = "rgba(30,35,36,0.18)";
    ctx.beginPath();
    ctx.moveTo(188, 382);
    ctx.lineTo(264, 398);
    ctx.lineTo(310, 536);
    ctx.lineTo(417, 920);
    ctx.lineTo(90, 920);
    ctx.lineTo(128, 565);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = GREEN;
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
  ctx.lineCap = "butt";
  ctx.fillStyle = "#fff";
  ctx.font = "700 34px 'Courier Prime', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(localizeText("Profil"), HEADER_X + 172, HEADER_Y + 43);
  ctx.drawImage(profileIcon, HEADER_X + 26, HEADER_Y + 16, 36, 36);

  ctx.fillStyle = "#000";
  ctx.font = `bold ${layout.titleFontSize}px 'Courier Prime', 'Courier New', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  drawTextLines(ctx, wrapText(titleText, Math.floor(TITLE_CHARS_PER_LINE / (layout.titleFontSize / TITLE_BASE_FONT_SIZE))), 43, TITLE_TOP, TITLE_WIDTH, layout.titleLineHeight, TITLE_WIDTH);

  if (hasDescription) {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(43, layout.descriptionTop);
    ctx.lineTo(43 + DESCRIPTION_WIDTH, layout.descriptionTop);
    ctx.moveTo(43, layout.descriptionTop + layout.descriptionBlockHeight);
    ctx.lineTo(43 + DESCRIPTION_WIDTH, layout.descriptionTop + layout.descriptionBlockHeight);
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = `italic ${layout.fontSize}px 'Courier Prime', 'Courier New', monospace`;
    drawTextLines(
      ctx,
      wrapText(profile.description, Math.floor(DESCRIPTION_CHARS_PER_LINE / (layout.fontSize / BASE_TEXT_FONT_SIZE))),
      43,
      layout.descriptionTop + DESCRIPTION_TEXT_TOP,
      DESCRIPTION_WIDTH,
      layout.lineHeight,
      DESCRIPTION_WIDTH,
    );
  }

  const facetImg = await loadImg(facetIcon);
  const traitsImg = await loadImg(traitsIcon);
  ctx.drawImage(facetImg, 37, layout.statsTop + 4, 54, 54);
  ctx.fillStyle = GREEN;
  ctx.font = "bold 32px 'Courier Prime', 'Courier New', monospace";
  ctx.fillText(localizeText("FACETTES:"), 104, layout.statsTop + 18);

  [
    [facetLabel(profile.facetteForteLabel, "Forte"), profile.facetteForte],
    [facetLabel(profile.facetteNeutreLabel, "Neutre"), profile.facetteNeutre],
    [facetLabel(profile.facetteFaibleLabel, "Faible"), profile.facetteFaible],
  ].forEach(([label, value], index) => {
    const x = 289 + index * 100;
    drawOctBox(ctx, value, x, layout.statsTop);
    ctx.fillStyle = GREEN;
    ctx.font = "bold 18px 'Courier Prime', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(localizeText(label), x + 46, layout.statsTop + 61, 92);
  });

  const traitsTop = layout.statsTop + 88;
  ctx.drawImage(traitsImg, 37, traitsTop + 6, 54, 39);
  ctx.fillStyle = GREEN;
  ctx.font = "bold 32px 'Courier Prime', 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(localizeText("TRAITS:"), 99, traitsTop + 12);
  [
    ["+", profile.traitPlus],
    ["-", profile.traitMoins],
  ].forEach(([label, value], index) => {
    const x = 289 + index * 100;
    drawOctBox(ctx, value, x, traitsTop);
    ctx.fillStyle = GREEN;
    ctx.font = "bold 34px 'Courier Prime', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(localizeText(label), x + 46, traitsTop + 50);
  });

  if (hasSpecial || hasCitation) {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 5;
    if (hasSpecial) {
      ctx.beginPath();
      ctx.moveTo(SPECIAL_FRAME_X + 2, layout.specialTop + 29);
      ctx.lineTo(SPECIAL_FRAME_X + 22, layout.specialTop + 8);
      ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 22, layout.specialTop + 8);
      ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 2, layout.specialTop + 29);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(SPECIAL_FRAME_X + 2, layout.specialTop + layout.specialBottomTop + 3);
      ctx.lineTo(SPECIAL_FRAME_X + 24, layout.specialTop + layout.specialBottomTop + 23);
      ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 24, layout.specialTop + layout.specialBottomTop + 23);
      ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 2, layout.specialTop + layout.specialBottomTop + 3);
      ctx.stroke();
      ctx.fillStyle = GREEN;
      const markerScale = layout.fontSize / BASE_TEXT_FONT_SIZE;
      ctx.font = `bold ${layout.fontSize}px 'Courier Prime', 'Courier New', monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        localizeText(""),
        SPECIAL_FRAME_X + SPECIAL_TITLE_LEFT,
        layout.specialTop + SPECIAL_TITLE_TOP,
      );
      ctx.font = `${layout.fontSize}px 'Courier Prime', 'Courier New', monospace`;
      ctx.textBaseline = "top";
      drawTextLines(
        ctx,
        wrapText(profile.special, Math.floor(SPECIAL_CHARS_PER_LINE / (layout.fontSize / BASE_TEXT_FONT_SIZE))),
        SPECIAL_FRAME_X + SPECIAL_TEXT_LEFT,
        layout.specialTop + SPECIAL_TEXT_TOP,
        SPECIAL_FRAME_WIDTH - SPECIAL_TEXT_LEFT * 2,
        layout.lineHeight,
        SPECIAL_FRAME_WIDTH - SPECIAL_TEXT_LEFT * 2,
      );
    }

    if (hasCitation) {
      if (!hasSpecial) {
        ctx.strokeStyle = "rgba(0,69,64,0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(SPECIAL_FRAME_X + 20, layout.specialTop + layout.citationTop - 5);
        ctx.lineTo(SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH - 20, layout.specialTop + layout.citationTop - 5);
        ctx.stroke();
      }
      ctx.fillStyle = GREEN;
      ctx.font = `bold italic ${layout.fontSize}px 'Courier Prime', 'Courier New', monospace`;
      ctx.textAlign = "center";
      drawCitation(
        ctx,
        profile.citation,
        SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH / 2,
        layout.specialTop + layout.citationTop,
        SPECIAL_FRAME_WIDTH,
        layout.lineHeight,
      );
    }
  }

  return canvas;
};

export const renderProfileCardBlob = async (profile: Profile): Promise<Blob> => {
  const canvas = await renderProfileCardCanvas(profile);
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};

export const exportProfilePng = async (profile: Profile): Promise<Blob> => {
  const blob = await renderProfileCardBlob(profile);
  return writePngText(blob, "clap-role-profile", JSON.stringify(profile));
};

export const importProfilePng = async (file: File): Promise<Profile | null> => {
  const text = await readPngText(file, "clap-role-profile");
  if (!text) return null;
  try {
    return migrateProfile(validateImportedResource("profile", parseJsonData(text)));
  } catch {
    return null;
  }
};
