import { measureCitationLines, drawCitation } from '@/lib/resourceCitation';
import { localizeText } from '@/i18n/localize';
import { renderResourceCardsPdf } from "./resourceCardsPdf";
import { migrateVehicle } from "./vehicles";
import { parseJsonData, validateImportedResource } from "./dataValidation";
import type { Vehicle, VehicleSides } from "./vehicles";
import { readPngText, writePngText } from "./pngMeta";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToPlainText } from "./richText";
import iconBlindage from "@/assets/vehicle-card/icone-blindage.svg";
import iconCoque from "@/assets/vehicle-card/icone-coque.svg";
import iconDegats from "@/assets/vehicle-card/icone-degats.svg";
import iconManiabilite from "@/assets/vehicle-card/icone-maniabilite.svg";
import iconVehicule from "@/assets/vehicle-card/icone-vehicule.svg";
import iconVitesse from "@/assets/vehicle-card/icone-vitesse.svg";

const META_KEY = "clap-role-vehicle";
const W = 744;
const H = 1039;
const BROWN = "#87330f";
const CARD_W_MM = 63;
const CARD_H_MM = 88;
const CARDS_PER_PAGE = 9;
const CARD_CONTENT_BOTTOM = 1016;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const TITLE_WIDTH = 610;
const TITLE_X = 48;
const TITLE_TOP = 111;
const TITLE_DESCRIPTION_GAP = 13;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 60;
const TITLE_BASELINE_OFFSET = 35;
const TITLE_CHARS_PER_LINE = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_WIDTH = 650;
const DESCRIPTION_TEXT_TOP = 15;
const DESCRIPTION_VERTICAL_CHROME = 30;
const DESCRIPTION_STATS_GAP = 20;
const DESCRIPTION_CHARS_PER_LINE = 34;
const STATS_MANEUVER_SPEED_HEIGHT = 136;
const STATS_BLINDAGE_HEIGHT = 93;
const STATS_DAMAGE_GAP = 20;
const STATS_DAMAGE_HEIGHT = 107;
const STAT_ICON_SIZE = 45;
const STAT_LABEL_COLUMN_WIDTH = 274;
const STAT_BOX_WIDTH = 97;
const STAT_BOX_HEIGHT = 63;
const STAT_BOX_GAP = 8;
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
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(localizeText(line), x, y + index * lineHeight, maxWidth));
};

const octPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  const cutX = w * 0.16;
  const cutY = h * 0.28;
  ctx.beginPath();
  ctx.moveTo(x + cutX, y);
  ctx.lineTo(x + w - cutX, y);
  ctx.lineTo(x + w, y + cutY);
  ctx.lineTo(x + w, y + h - cutY);
  ctx.lineTo(x + w - cutX, y + h);
  ctx.lineTo(x + cutX, y + h);
  ctx.lineTo(x, y + h - cutY);
  ctx.lineTo(x, y + cutY);
  ctx.closePath();
};

const withWhiteGlow = (ctx: CanvasRenderingContext2D, draw: () => void, blur = 10) => {
  ctx.save();
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  draw();
  draw();
  draw();
  ctx.restore();
};

const drawGlowingText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) => {
  withWhiteGlow(ctx, () => ctx.fillText(localizeText(text), x, y, maxWidth));
  ctx.fillText(localizeText(text), x, y, maxWidth);
};

const drawCenteredGlowingText = (ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number) => {
  const metrics = ctx.measureText(localizeText(text));
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baselineY = ascent || descent ? centerY + (ascent - descent) / 2 : centerY;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  drawGlowingText(ctx, text, centerX, baselineY);
};

const fitGlowingText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
  ctx.save();
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  fitText(ctx, text, x, y, maxWidth, lineHeight, maxLines);
  fitText(ctx, text, x, y, maxWidth, lineHeight, maxLines);
  fitText(ctx, text, x, y, maxWidth, lineHeight, maxLines);
  ctx.restore();
  fitText(ctx, text, x, y, maxWidth, lineHeight, maxLines);
};

const drawGlowingImage = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  withWhiteGlow(ctx, () => ctx.drawImage(image, x, y, w, h), 8);
  ctx.drawImage(image, x, y, w, h);
};

const drawOctBox = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, w = STAT_BOX_WIDTH, h = STAT_BOX_HEIGHT) => {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = BROWN;
  octPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#fff";
  octPath(ctx, x + 6, y + 6, w - 12, h - 12);
  ctx.fill();
  ctx.fillStyle = BROWN;
  ctx.font = "700 32px 'Courier Prime', monospace";
  drawCenteredGlowingText(ctx, value || "-", x + w / 2, y + h / 2);
  ctx.textBaseline = "alphabetic";
};

const drawDirectionBoxes = (ctx: CanvasRenderingContext2D, values: VehicleSides, x: number, y: number) => {
  const items: [string, string][] = [
    ["Avant", values.avant],
    ["Gauche", values.gauche],
    ["Droit", values.droit],
    ["Arriere", values.arriere],
  ];
  items.forEach(([label, value], index) => {
    const boxX = x + index * (STAT_BOX_WIDTH + STAT_BOX_GAP);
    drawOctBox(ctx, value, boxX, y);
    ctx.fillStyle = BROWN;
    ctx.font = "700 18px 'Courier Prime', monospace";
    ctx.textAlign = "center";
    drawGlowingText(ctx, label, boxX + STAT_BOX_WIDTH / 2, y + 81);
  });
};

const drawDamageBoxes = (ctx: CanvasRenderingContext2D, weapons: Vehicle["armes"], x: number, y: number) => {
  weapons
    .filter((weapon) => weapon.degats.trim())
    .slice(0, 4)
    .forEach((weapon, index) => {
      const boxX = x + index * (STAT_BOX_WIDTH + STAT_BOX_GAP);
      drawOctBox(ctx, weapon.degats, boxX, y);
      if (weapon.nom.trim()) {
        ctx.fillStyle = BROWN;
        ctx.font = "700 16px 'Courier Prime', monospace";
        ctx.textAlign = "center";
        fitGlowingText(ctx, weapon.nom, boxX + STAT_BOX_WIDTH / 2, y + 81, STAT_BOX_WIDTH, 17, 2);
      }
    });
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

const drawStatLabel = (ctx: CanvasRenderingContext2D, icon: string, label: string, x: number, y: number) => {
  ctx.fillStyle = BROWN;
  ctx.font = "700 28px 'Courier Prime', monospace";
  ctx.textAlign = "left";
  ctx.fillText(localizeText(icon), x, y);
  ctx.fillText(localizeText(`${label}:`), x + 56, y);
};

const drawStatLabelWithImage = (ctx: CanvasRenderingContext2D, icon: HTMLImageElement, label: string, x: number, centerY: number, labelOffsetY = 3) => {
  drawGlowingImage(ctx, icon, x, centerY - STAT_ICON_SIZE / 2, STAT_ICON_SIZE, STAT_ICON_SIZE);
  ctx.fillStyle = BROWN;
  ctx.font = "700 32px 'Courier Prime', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  drawGlowingText(ctx, `${label}:`, x + 52, centerY + 1 + labelOffsetY);
  ctx.textBaseline = "alphabetic";
};

export const renderVehicleCardCanvas = async (vehicle: Vehicle, outputWidth = W): Promise<HTMLCanvasElement> => {
  const [blindageIcon, coqueIcon, degatsIcon, maniabiliteIcon, vehiculeIcon, vitesseIcon] = await Promise.all([
    loadImg(iconBlindage),
    loadImg(iconCoque),
    loadImg(iconDegats),
    loadImg(iconManiabilite),
    loadImg(iconVehicule),
    loadImg(iconVitesse),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(H * outputWidth / W);
  const ctx = canvas.getContext("2d")!;
  if (outputWidth !== W) ctx.scale(outputWidth / W, outputWidth / W);
  const visibleDamageWeapons = vehicle.armes.filter((weapon) => weapon.degats.trim());
  const hasDamage = visibleDamageWeapons.length > 0;
  const hasDescription = vehicle.description.trim().length > 0;
  const hasSpecial = richTextToPlainText(vehicle.special).trim().length > 0;
  const hasCitation = vehicle.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((vehicle.titre || "Sans nom").toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_TEXT_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(vehicle.description, DESCRIPTION_TEXT_WIDTH, `italic 400 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const specialLines = hasSpecial ? measureRichTextLines(vehicle.special, 612, fontSize) : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(`« ${vehicle.citation} »`, SPECIAL_FRAME_WIDTH, `italic 700 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const citationLines = hasCitation ? rawCitationLines : 0;
    const descriptionHeight = descriptionLines * lineHeight + (hasDescription ? textClipSafety : 0);
    const descriptionBlockHeight = hasDescription ? descriptionHeight + DESCRIPTION_VERTICAL_CHROME : 0;
    const statsTop = hasDescription ? descriptionTop + descriptionBlockHeight + DESCRIPTION_STATS_GAP : descriptionTop;
    const statsBlockHeight =
      STATS_MANEUVER_SPEED_HEIGHT +
      STATS_BLINDAGE_HEIGHT +
      (hasDamage ? STATS_DAMAGE_GAP + STATS_DAMAGE_HEIGHT : 0);
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
      descriptionHeight,
      descriptionLines,
      descriptionTop,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialHeight,
      specialLines,
      specialSectionHeight,
      statsBlockHeight,
      statsTop,
      titleFontSize,
      titleLineHeight,
      titleLines: rawTitleLines,
      fits: statsTop + statsBlockHeight + specialSectionHeight <= CARD_CONTENT_BOTTOM,
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
    descriptionHeight,
    descriptionLines,
    descriptionTop,
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
  ctx.roundRect(17, 17, 710, 1005, 18);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(17, 17, 710, 1005, 18);
  ctx.clip();
  if (vehicle.image) {
    try {
      const img = await loadImg(vehicle.image);
      ctx.globalAlpha = 0.3;
      drawCoverImage(ctx, img, 17, 17, 710, 1005);
      ctx.globalAlpha = 1;
      drawWhiteEdgeVignette(ctx, 17, 17, 710, 1005);
    } catch {
      ctx.fillStyle = "#eee";
      ctx.fillRect(17, 17, 710, 1005);
    }
  } else {
    const gradient = ctx.createRadialGradient(520, 240, 10, 520, 240, 260);
    gradient.addColorStop(0, "rgba(239,139,72,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(17, 17, 710, 1005);
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(17, 17, 710, 1005);
  ctx.restore();

  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.moveTo(13, 13);
  ctx.lineTo(373, 13);
  ctx.lineTo(351, 89);
  ctx.lineTo(13, 89);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 5;
  ctx.setLineDash([1, 8]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(31, 27);
  ctx.lineTo(341, 27);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(31, 73);
  ctx.lineTo(336, 73);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.font = "700 34px 'Courier Prime', monospace";
  ctx.drawImage(vehiculeIcon, 44, 41, 30, 25);
  ctx.fillText(localizeText("Vehicule"), 100, 62);

  ctx.fillStyle = BROWN;
  ctx.font = "700 32px 'Courier Prime', monospace";
  drawGlowingImage(ctx, coqueIcon, 452, 37, STAT_ICON_SIZE, STAT_ICON_SIZE);
  drawGlowingText(ctx, "COQUE:", 502, 70);
  drawOctBox(ctx, vehicle.coque, 619, 27);

  ctx.fillStyle = "#000";
  ctx.font = `700 ${titleFontSize}px 'Courier Prime', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.save();
  ctx.beginPath();
  ctx.rect(TITLE_X, TITLE_TOP, TITLE_WIDTH, titleLines * titleLineHeight);
  ctx.clip();
  fitGlowingText(
    ctx,
    (vehicle.titre || "Sans nom").toUpperCase(),
    TITLE_X,
    TITLE_TOP + titleFontSize * (TITLE_BASELINE_OFFSET / TITLE_BASE_FONT_SIZE),
    TITLE_WIDTH,
    titleLineHeight,
    titleLines,
  );
  ctx.restore();

  if (hasDescription) {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(43, descriptionTop);
    ctx.lineTo(43 + DESCRIPTION_WIDTH, descriptionTop);
    ctx.stroke();
    ctx.fillStyle = BROWN;
    ctx.font = `italic 400 ${textFontSize}px 'Courier Prime', monospace`;
    fitGlowingText(
      ctx,
      vehicle.description,
      43,
      descriptionTop + DESCRIPTION_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
      DESCRIPTION_TEXT_WIDTH,
      textLineHeight,
      descriptionLines,
    );
    ctx.beginPath();
    ctx.moveTo(43, descriptionTop + descriptionBlockHeight);
    ctx.lineTo(43 + DESCRIPTION_WIDTH, descriptionTop + descriptionBlockHeight);
    ctx.stroke();
  }

  drawStatLabelWithImage(ctx, maniabiliteIcon, "MANIABILITE", 28, statsTop + STAT_BOX_HEIGHT / 2);
  drawOctBox(ctx, vehicle.maniabilite, 37 + STAT_LABEL_COLUMN_WIDTH, statsTop);
  drawStatLabelWithImage(ctx, vitesseIcon, "VITESSE", 28, statsTop + 71 + STAT_BOX_HEIGHT / 2);
  drawOctBox(ctx, vehicle.vitesse, 37 + STAT_LABEL_COLUMN_WIDTH, statsTop + 71);
  drawStatLabelWithImage(ctx, blindageIcon, "BLINDAGE", 28, statsTop + 142 + STAT_BOX_HEIGHT / 2, 6);
  drawDirectionBoxes(ctx, vehicle.blindage, 37 + STAT_LABEL_COLUMN_WIDTH, statsTop + 142);
  if (hasDamage) {
    drawStatLabelWithImage(ctx, degatsIcon, "DEGATS", 28, statsTop + 238 + STAT_BOX_HEIGHT / 2);
    drawDamageBoxes(ctx, visibleDamageWeapons, 37 + STAT_LABEL_COLUMN_WIDTH, statsTop + 238);
  }

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
    drawGlowingText(
      ctx,
      "",
      SPECIAL_FRAME_X + SPECIAL_TITLE_LEFT,
      specialTop + SPECIAL_TITLE_TOP + textFontSize * SPECIAL_TITLE_BASELINE_RATIO,
    );
    ctx.font = `400 ${textFontSize}px 'Courier Prime', monospace`;
    fitGlowingText(
      ctx,
      richTextToPlainText(vehicle.special),
      SPECIAL_FRAME_X + SPECIAL_TEXT_LEFT,
      specialTop + SPECIAL_TEXT_TOP + textFontSize * TEXT_BASELINE_RATIO,
      SPECIAL_FRAME_WIDTH - SPECIAL_TEXT_LEFT * 2,
      textLineHeight,
      specialLines,
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
    withWhiteGlow(ctx, () => drawCitation(
      ctx,
      `« ${vehicle.citation} »`,
      SPECIAL_FRAME_X + SPECIAL_FRAME_WIDTH / 2,
      specialTop + citationTop + textFontSize * CITATION_BASELINE_RATIO,
      SPECIAL_FRAME_WIDTH,
      textLineHeight,
    ));
  }

  return canvas;
};

export const renderVehicleCardBlob = async (vehicle: Vehicle): Promise<Blob> => {
  const canvas = await renderVehicleCardCanvas(vehicle);
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};

export const exportVehiclePng = async (vehicle: Vehicle): Promise<Blob> => {
  const blob = await renderVehicleCardBlob(vehicle);
  return writePngText(blob, META_KEY, JSON.stringify(vehicle));
};

export const exportVehiclesA4Pdf = async (vehicles: Vehicle[]): Promise<Blob> => {
  return renderResourceCardsPdf(vehicles, renderVehicleCardBlob, false, "vehicle");
};

export const importVehiclePng = async (file: File): Promise<Vehicle | null> => {
  const text = await readPngText(file, META_KEY);
  if (!text) return null;
  try {
    return migrateVehicle(validateImportedResource("vehicle", parseJsonData(text)));
  } catch {
    return null;
  }
};
