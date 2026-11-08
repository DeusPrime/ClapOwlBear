import { measureCitationLines } from '@/lib/resourceCitation';
import { localizeText, localizeNode } from '@/i18n/localize';
import { Vehicle, VehicleSides } from "@/lib/vehicles";
import ResourceRollValue from "./ResourceRollValue";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToHtml, richTextToPlainText } from "@/lib/richText";
import iconBlindage from "@/assets/vehicle-card/icone-blindage.svg";
import iconCoque from "@/assets/vehicle-card/icone-coque.svg";
import iconDegats from "@/assets/vehicle-card/icone-degats.svg";
import iconManiabilite from "@/assets/vehicle-card/icone-maniabilite.svg";
import iconVehicule from "@/assets/vehicle-card/icone-vehicule.svg";
import iconVitesse from "@/assets/vehicle-card/icone-vitesse.svg";

const BROWN = "#87330f";
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const CARD_CONTENT_BOTTOM = 1016;
const TITLE_TOP = 111;
const TITLE_WIDTH = 610;
const TITLE_DESCRIPTION_GAP = 13;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 60;
const TITLE_CHARS_PER_LINE = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_WIDTH = 650;
const DESCRIPTION_TEXT_TOP = 15;
const DESCRIPTION_VERTICAL_CHROME = 30;
const DESCRIPTION_STATS_GAP = 20;
const STATS_MANEUVER_SPEED_HEIGHT = 136;
const STATS_BLINDAGE_HEIGHT = 93;
const STATS_DAMAGE_GAP = 20;
const STATS_DAMAGE_HEIGHT = 107;
const STAT_ICON_SIZE = 45;
const STAT_BOX_WIDTH = 97;
const STAT_LABEL_COLUMN_WIDTH = 274;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_LINE_HEIGHT = 39;
const SPECIAL_FRAME_X = 42;
const SPECIAL_FRAME_WIDTH = 660;
const SPECIAL_TITLE_LEFT = 30;
const SPECIAL_TEXT_LEFT = 24;
const SPECIAL_TITLE_TOP = 29;
const SPECIAL_TEXT_TOP = 35;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_CITATION_GAP = 4;
const SPECIAL_CITATION_BOTTOM_GAP = 0;
const CITATION_SEPARATOR_GAP = 8;
const SPECIAL_CHARS_PER_LINE = 34;
const CITATION_CHARS_PER_LINE = 32;
const DESCRIPTION_CHARS_PER_LINE = 34;
const MIN_TEXT_SCALE = 0.02;

const OctBox = ({ value, className = "" }: { value: string; className?: string }) => (
  <div
    className={`flex h-[63px] w-[97px] items-center justify-center bg-[var(--vehicle-brown)] p-[6px] drop-shadow-[4px_5px_0_rgba(0,0,0,0.28)] ${className}`}
    style={{ clipPath: "polygon(16% 0, 84% 0, 100% 28%, 100% 72%, 84% 100%, 16% 100%, 0 72%, 0 28%)" }}
  >
    <div
      className="role-glow flex h-full w-full items-center justify-center bg-white text-[32px] font-bold leading-none text-[var(--vehicle-brown)]"
      style={{ clipPath: "polygon(16% 0, 84% 0, 100% 28%, 100% 72%, 84% 100%, 16% 100%, 0 72%, 0 28%)" }}
    >
      <span className="block translate-y-[2px]">{localizeNode(value || "-")}</span>
    </div>
  </div>
);

const DirectionBoxes = ({ values }: { values: VehicleSides }) => {
  const items = [
    ["Avant", values.avant],
    ["Gauche", values.gauche],
    ["Droit", values.droit],
    ["Arriere", values.arriere],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="w-[97px] text-center">
          <OctBox value={value} className="mx-auto" />
          <div className="role-glow mt-1 text-[18px] font-bold leading-none text-[var(--vehicle-brown)]">{localizeNode(label)}</div>
        </div>
      ))}
    </div>
  );
};

const DamageBoxes = ({ weapons }: { weapons: Vehicle["armes"] }) => {
  const visibleWeapons = weapons.filter((weapon) => weapon.degats.trim());
  if (!visibleWeapons.length) return null;

  return (
    <div className="flex gap-2">
      {visibleWeapons.slice(0, 4).map((weapon, index) => (
        <div key={index} className="relative h-[107px] w-[97px] shrink-0 text-center">
          <OctBox value={weapon.degats} />
          {weapon.nom.trim() && (
            <div className="role-glow absolute left-0 top-[68px] line-clamp-2 w-full break-words text-center text-[16px] font-bold leading-[17px] text-[var(--vehicle-brown)]">
              {weapon.nom}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const CornerMarker = () => null;

const StatLabel = ({ icon, label, labelOffsetY = 3 }: { icon: React.ReactNode; label: string; labelOffsetY?: number }) => (
  <div className="flex h-[63px] -translate-x-[10px] items-center gap-2 text-[32px] font-bold uppercase leading-none text-[var(--vehicle-brown)]">
    <div className="flex h-[44px] w-[44px] items-center justify-center">{localizeNode(icon)}</div>
    <span className="role-glow flex h-[63px] w-[185px] shrink-0 items-center" style={{ transform: `translateY(${labelOffsetY}px)` }}>{localizeNode(label)}:</span>
  </div>
);

const VehicleAssetIcon = ({ src, size = STAT_ICON_SIZE }: { src: string; size?: number }) => (
  <img
    src={src}
    alt=""
    className="max-w-none object-contain [filter:drop-shadow(0_0_10px_rgb(255_255_255_/_0.36))_drop-shadow(0_0_6px_rgb(255_255_255_/_0.58))_drop-shadow(0_0_3px_rgb(255_255_255_/_0.82))]"
    style={{ width: size, height: size }}
    draggable={false}
  />
);

const VehicleHeaderIcon = ({ className = "" }: { className?: string }) => (
  <img src={iconVehicule} alt="" className={className} draggable={false} />
);

const VehicleCard = ({ vehicle, scale = 1, onStatRoll }: { vehicle: Vehicle; scale?: number; onStatRoll?: (stat: "maniabilite" | "vitesse") => void }) => {
  const visibleDamageWeapons = vehicle.armes.filter((weapon) => weapon.degats.trim());
  const hasDamage = visibleDamageWeapons.length > 0;
  const hasDescription = vehicle.description.trim().length > 0;
  const specialHtml = richTextToHtml(vehicle.special);
  const hasSpecial = richTextToPlainText(vehicle.special).trim().length > 0;
  const hasCitation = vehicle.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((vehicle.titre || localizeText("Sans nom")).toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_LINE_HEIGHT * textScale;
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
      citationTop,
      descriptionBlockHeight,
      descriptionHeight,
      descriptionTop,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialHeight,
      specialSectionHeight,
      statsBlockHeight,
      statsTop,
      titleFontSize,
      titleHeight,
      titleLineHeight,
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
    citationTop,
    descriptionBlockHeight,
    descriptionHeight,
    descriptionTop,
    fontSize: textFontSize,
    lineHeight: textLineHeight,
    specialBottomTop,
    specialHeight,
    specialSectionHeight,
    statsTop,
    titleFontSize,
    titleHeight,
    titleLineHeight,
  } = textLayout;
  const specialTop = CARD_CONTENT_BOTTOM - specialSectionHeight;
  const textScale = textFontSize / BASE_TEXT_FONT_SIZE;

  return (
    <div
      className="origin-top-left overflow-hidden"
      style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale, fontFamily: "'Courier Prime', 'Courier New', monospace" }}
      aria-label={localizeText(`Carte vehicule ${vehicle.titre || localizeText("sans nom")}`)}
    >
      <div
        className="relative h-[1039px] w-[744px] overflow-hidden rounded-[30px] bg-[var(--vehicle-brown)] p-[17px] text-[var(--vehicle-brown)]"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", ["--vehicle-brown" as string]: BROWN }}
      >
        <div className="absolute inset-[17px] rounded-[18px] bg-white" />
        {localizeNode(vehicle.image ? (
          <img src={vehicle.image} alt="" className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] object-cover object-center opacity-30" draggable={false} />
        ) : (
          <div className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] bg-[radial-gradient(circle_at_67%_24%,rgba(234,132,62,0.34),transparent_22%),linear-gradient(120deg,rgba(255,255,255,1),rgba(232,232,232,0.95))]" />
        ))}
        <div className="pointer-events-none absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] shadow-[inset_0_0_55px_38px_rgba(255,255,255,0.92)]" />
        <div className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] bg-white/55" />

        <div className="absolute left-[13px] top-[13px] h-[76px] w-[360px] bg-[var(--vehicle-brown)] text-white [clip-path:polygon(0_0,100%_0,94%_100%,0_100%)]">
          <div className="absolute left-[31px] right-[44px] top-[8px] border-t-[5px] border-dotted border-white/85" />
          <div className="absolute bottom-[8px] left-[31px] right-[44px] border-t-[5px] border-dotted border-white/85" />
          <VehicleHeaderIcon className="absolute left-[31px] top-[28px] h-[25px] w-[30px]" />
          <div className="absolute left-[87px] top-[24px] text-[34px] font-bold leading-none">{localizeText("Vehicule")}</div>
        </div>

        <div className="absolute right-[25px] top-[31px] flex items-center gap-3 text-[32px] font-bold uppercase">
          <VehicleAssetIcon src={iconCoque} />
          <span className="role-glow translate-y-[3px]">{localizeText("COQUE:")}</span>
          <OctBox value={vehicle.coque} />
        </div>

        <div className="absolute left-[43px]" style={{ top: TITLE_TOP, width: TITLE_WIDTH }}>
          <div
            className="role-glow overflow-hidden break-words font-bold uppercase text-black"
            style={{ height: titleHeight, fontSize: titleFontSize, lineHeight: `${titleLineHeight}px` }}
          >
            {vehicle.titre || localizeText("Sans nom")}
          </div>
        </div>

        {hasDescription && (
          <div
            className="absolute left-[43px] border-y-2 border-[var(--vehicle-brown)]"
            style={{ top: descriptionTop, width: DESCRIPTION_WIDTH, height: descriptionBlockHeight }}
          >
            <p
              className="role-glow absolute left-0 m-0 overflow-hidden whitespace-pre-wrap break-words italic"
              style={{
                top: DESCRIPTION_TEXT_TOP,
                width: DESCRIPTION_TEXT_WIDTH,
                height: descriptionHeight,
                fontSize: textFontSize,
                lineHeight: `${textLineHeight}px`,
              }}
            >
              {vehicle.description}
            </p>
          </div>
        )}

        <div className="absolute left-[37px] w-[685px]" style={{ top: statsTop }}>
          <div className="relative grid items-center" style={{ gridTemplateColumns: `${STAT_LABEL_COLUMN_WIDTH}px ${STAT_BOX_WIDTH}px` }}>
            <StatLabel icon={<VehicleAssetIcon src={iconManiabilite} />} label={localizeText("Maniabilite")} />
            {localizeNode(onStatRoll ? <ResourceRollValue tourTarget="roll-handling" value={vehicle.maniabilite} color={BROWN} fullHeight label={localizeText("Lancer avec la maniabilité")} onClick={() => onStatRoll("maniabilite")} /> : <OctBox value={vehicle.maniabilite} />)}
          </div>
          <div className="relative mt-2 grid items-center" style={{ gridTemplateColumns: `${STAT_LABEL_COLUMN_WIDTH}px ${STAT_BOX_WIDTH}px` }}>
            <StatLabel icon={<VehicleAssetIcon src={iconVitesse} />} label={localizeText("Vitesse")} />
            {localizeNode(onStatRoll ? <ResourceRollValue tourTarget="roll-speed" value={vehicle.vitesse} color={BROWN} fullHeight label={localizeText("Lancer avec la vitesse")} onClick={() => onStatRoll("vitesse")} /> : <OctBox value={vehicle.vitesse} />)}
          </div>
          <div className="mt-2 grid items-start" style={{ gridTemplateColumns: `${STAT_LABEL_COLUMN_WIDTH}px 1fr` }}>
            <StatLabel icon={<VehicleAssetIcon src={iconBlindage} />} label={localizeText("Blindage")} labelOffsetY={6} />
            <DirectionBoxes values={vehicle.blindage} />
          </div>
          {localizeNode(hasDamage && (
            <div className="mt-[11px] grid items-start" style={{ gridTemplateColumns: `${STAT_LABEL_COLUMN_WIDTH}px 1fr` }}>
              <StatLabel icon={<VehicleAssetIcon src={iconDegats} />} label={localizeText("Degats")} />
              <DamageBoxes weapons={visibleDamageWeapons} />
            </div>
          ))}
        </div>

        {(hasSpecial || hasCitation) && (
          <div className="absolute" style={{ left: SPECIAL_FRAME_X, top: specialTop, width: SPECIAL_FRAME_WIDTH, height: specialSectionHeight }}>
            {localizeNode(hasSpecial && (
              <>
                <svg aria-hidden="true" className="absolute left-0 top-0 h-[28px] w-full overflow-visible" viewBox="0 0 660 32" preserveAspectRatio="none">
                  <path d="M2 29 L22 8 H638 L658 29" fill="none" stroke="currentColor" strokeWidth="5" />
                </svg>
                <div className="hidden">{localizeText("Capacites speciales:")}</div>
                <div
                  className="role-glow absolute overflow-hidden break-words [&_em]:italic [&_i]:italic [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-[33px] [&_strong]:font-bold [&_u]:underline [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[28px] [&_li]:m-0 [&_li]:pl-[2px]"
                  style={{
                    left: SPECIAL_TEXT_LEFT,
                    right: SPECIAL_TEXT_LEFT,
                    top: SPECIAL_TEXT_TOP,
                    height: specialHeight,
                    fontSize: textFontSize,
                    lineHeight: `${textLineHeight}px`,
                  }}
                  dangerouslySetInnerHTML={{ __html: specialHtml }}
                />
                <svg aria-hidden="true" className="absolute left-0 h-[28px] w-full overflow-visible" style={{ top: specialBottomTop }} viewBox="0 0 660 32" preserveAspectRatio="none">
                  <path d="M2 3 L24 23 H636 L658 3" fill="none" stroke="currentColor" strokeWidth="5" />
                </svg>
              </>
            ))}
            {localizeNode(hasCitation && !hasSpecial && (
              <div className="absolute left-[20px] h-[1px] bg-[var(--vehicle-brown)] opacity-70" style={{ top: citationTop - 5, width: SPECIAL_FRAME_WIDTH - 40 }} />
            ))}
            {hasCitation && (
              <p
                className="role-glow absolute left-0 m-0 w-full px-[6px] overflow-visible whitespace-pre-wrap break-words text-center font-bold italic"
                style={{ top: citationTop, height: citationHeight, fontSize: textFontSize, lineHeight: `${textLineHeight}px` }}
              >
                « {vehicle.citation} »
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleCard;
