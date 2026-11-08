import { measureCitationLines } from '@/lib/resourceCitation';
import { localizeText, localizeNode } from '@/i18n/localize';
import { KeyRole } from "@/lib/keyRoles";
import ResourceRollValue from "./ResourceRollValue";
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
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToBlocks, richTextToPlainText } from "@/lib/richText";

const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const CARD_VISIBLE_X = 15;
const CARD_VISIBLE_Y = 12;
const CARD_VISIBLE_WIDTH = CARD_WIDTH - CARD_VISIBLE_X;
const CARD_VISIBLE_HEIGHT = CARD_HEIGHT - CARD_VISIBLE_Y;
const CARD_CONTENT_BOTTOM = 1026;
const CARD_FILL_X = 24;
const CARD_FILL_Y = 21;
const CARD_FILL_WIDTH = 711;
const CARD_FILL_HEIGHT = 1009;
const CARD_IMAGE_X = 33;
const CARD_IMAGE_Y = 30;
const CARD_IMAGE_WIDTH = 693;
const CARD_IMAGE_HEIGHT = 991;
const TITLE_WIDTH = 660;
const TITLE_TOP = 121;
const TITLE_DESCRIPTION_GAP = 20;
const TITLE_BASE_FONT_SIZE = 60;
const TITLE_BASE_LINE_HEIGHT = 67;
const TITLE_CHARS_PER_LINE = 18;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_TOP = 8;
const DESCRIPTION_VERTICAL_CHROME = 24;
const DESCRIPTION_STATS_GAP = 28;
const RED = "#570211";
const SPECIAL_INK = RED;
const SPECIAL_FRAME_X = 45;
const SPECIAL_FRAME_WIDTH = 668;
const SPECIAL_TOP_DECOR_HEIGHT = 32;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_TITLE_MARKER_SIZE = 34;
const SPECIAL_TITLE_MARKER_LEFT = 14;
const SPECIAL_TITLE_MARKER_TOP = 21;
const SPECIAL_TITLE_LEFT = 31;
const SPECIAL_TEXT_LEFT = 20;
const SPECIAL_TITLE_TOP = 29;
const SPECIAL_TEXT_TOP = 29;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_CITATION_GAP = 3;
const SPECIAL_CITATION_BOTTOM_GAP = 4;
const SPECIAL_NO_CITATION_BOTTOM_GAP = 24;
const CITATION_SEPARATOR_GAP = 8;
const SINGLE_WEAPON_ATTRIBUTES_BOTTOM_OFFSET = 204;
const MULTI_WEAPON_ATTRIBUTES_BOTTOM_OFFSET = 204;
const MAX_WEAPONS = 4;
const DAMAGE_BOX_WIDTH = 97;
const DAMAGE_ROW_SLOT_WIDTH = 95;
const DAMAGE_ROW_TOP = 59;
const DAMAGE_ROW_LEFT = -10;
const HEADER_CONTENT_Y_OFFSET = -1;
const HEADER_CROWN_Y_OFFSET = -2;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const DESCRIPTION_CHARS_PER_LINE = 34;
const SPECIAL_CHARS_PER_LINE = 31;
const CITATION_CHARS_PER_LINE = 33;
const MIN_TEXT_SCALE = 0.02;

type StatKind = "corps" | "esprit" | "ame" | "armure" | "degats";

const statIcons: Record<StatKind, string> = {
  corps: iconCorps,
  esprit: iconEsprit,
  ame: iconAme,
  armure: iconArmure,
  degats: iconDegats,
};

const statCases: Record<StatKind, string> = {
  corps: caseCorps,
  esprit: caseEsprit,
  ame: caseAme,
  armure: caseArmure,
  degats: caseDegats,
};

const StatIcon = ({ kind }: { kind: StatKind }) => (
  <span className="relative flex h-[45px] w-[39px] shrink-0 items-center justify-center">
    <img src={statIcons[kind]} alt="" className="h-[45px] w-[45px] max-w-none -translate-y-[4px] object-contain" draggable={false} />
  </span>
);

const ValueBox = ({ value, kind }: { value: string; kind: StatKind }) => (
  <span className="relative flex h-[63px] w-[97px] shrink-0 items-center justify-center">
    <img src={statCases[kind]} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
    <span className="role-glow-strong relative z-[1] mt-[-5px] text-[32px] font-bold leading-none text-[var(--role-red)]">
      {localizeNode(value || "-")}
    </span>
  </span>
);

const Stat = ({ label, value, kind, onRoll }: { label: string; value: string; kind: StatKind; onRoll?: () => void }) => (
  <div className="flex h-[58px] items-center gap-3">
    <StatIcon kind={kind} />
    <span className="role-glow min-w-[135px] text-[32px] font-bold uppercase leading-none text-[var(--role-red)]">
      {localizeNode(label)}:
    </span>
    {localizeNode(onRoll ? <ResourceRollValue tourTarget={`roll-${kind}`} value={value} color="var(--role-red)" label={localizeText(`Lancer la facette ${kind}`)} onClick={onRoll} /> : <ValueBox value={value} kind={kind} />)}
  </div>
);

const SingleDamageStat = ({ weaponName, value }: { weaponName: string; value: string }) => (
  <div className="relative h-[82px]">
    <div className="flex h-[58px] items-center gap-3">
      <StatIcon kind="degats" />
      <span className="role-glow min-w-[135px] text-[32px] font-bold uppercase leading-none text-[var(--role-red)]">{localizeText(" Degats: ")}</span>
      <div className="relative h-[63px] w-[97px] shrink-0">
        <ValueBox value={value} kind="degats" />
        <span className="role-glow absolute left-0 top-[61px] line-clamp-2 w-full text-center text-[20px] font-bold leading-[22px] text-[var(--role-red)]">
          {localizeNode(weaponName)}
        </span>
      </div>
    </div>
  </div>
);

const WeaponDamageTile = ({ weaponName, value }: { weaponName: string; value: string }) => (
  <div className="relative h-[107px] w-[97px]">
    <ValueBox value={value} kind="degats" />
    <span className="role-glow absolute left-0 top-[63px] line-clamp-2 w-full text-center text-[16px] font-bold leading-[17px] text-[var(--role-red)]">
      {localizeNode(weaponName)}
    </span>
  </div>
);

const MultiDamageStat = ({ weapons }: { weapons: { nom: string; degats: string }[] }) => (
  <div className="relative h-[151px]">
    <div className="flex h-[58px] items-center gap-3">
      <StatIcon kind="degats" />
      <span className="role-glow min-w-[135px] text-[32px] font-bold uppercase leading-none text-[var(--role-red)]">{localizeText(" Degats: ")}</span>
    </div>
    <div
      className="absolute"
      style={{
        left: DAMAGE_ROW_LEFT + ((MAX_WEAPONS - weapons.length) * DAMAGE_ROW_SLOT_WIDTH) / 2,
        top: DAMAGE_ROW_TOP,
        width: (weapons.length - 1) * DAMAGE_ROW_SLOT_WIDTH + DAMAGE_BOX_WIDTH,
      }}
    >
      {weapons.map((weapon, index) => (
        <div key={index} className="absolute top-0" style={{ left: index * DAMAGE_ROW_SLOT_WIDTH }}>
          <WeaponDamageTile value={weapon.degats} weaponName={weapon.nom} />
        </div>
      ))}
    </div>
  </div>
);

const PvBox = ({ value }: { value: string }) => (
  <span className="relative flex h-[63px] w-[97px] shrink-0 items-center justify-center">
    <img src={caseCorps} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
    <span className="role-glow-strong relative z-[1] mt-[-5px] text-[32px] font-bold leading-none text-[var(--role-red)]">
      {localizeNode(value || "-")}
    </span>
  </span>
);

const HeaderBand = () => (
  <div
    className="absolute left-[32px] top-[28px] h-[64px] w-[365px] bg-[var(--role-red)] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
    style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
  >
    <div className="absolute left-[17px] z-[2] h-[10px] w-[309px] border-t-4 border-dotted border-white/90" style={{ top: 3 + HEADER_CONTENT_Y_OFFSET }} />
    <div className="absolute left-[17px] z-[2] h-[10px] w-[309px] border-b-4 border-dotted border-white/90" style={{ bottom: 6 - HEADER_CONTENT_Y_OFFSET }} />
    <img src={crownIcon} alt="" className="absolute left-[24px] z-[3] h-[33px] w-[37px]" style={{ top: 18 + HEADER_CONTENT_Y_OFFSET + HEADER_CROWN_Y_OFFSET }} draggable={false} />
    <div className="absolute left-[83px] z-[3] text-[40px] font-bold leading-none text-white" style={{ top: 15 + HEADER_CONTENT_Y_OFFSET }}>{localizeText("Role cle")}</div>
  </div>
);

const Border = () => (
  <>
    <div className="pointer-events-none absolute left-[15px] top-[12px] h-[1027px] w-[729px] rounded-[30px] border-[18px] border-[var(--role-red)]" />
  </>
);

const KeyRoleCard = ({ role, scale = 1, onFacetRoll }: { role: KeyRole; scale?: number; onFacetRoll?: (facet: "corps" | "esprit" | "ame") => void }) => {
  const weapons = (role.armes.length ? role.armes : [{ nom: "", degats: "" }]).slice(0, MAX_WEAPONS);
  const hasMultipleWeapons = weapons.length > 1;
  const attributesBottomOffset = hasMultipleWeapons ? MULTI_WEAPON_ATTRIBUTES_BOTTOM_OFFSET : SINGLE_WEAPON_ATTRIBUTES_BOTTOM_OFFSET;
  const hasDescription = role.description.trim().length > 0;
  const descriptionText = role.description;
  const specialPlainText = richTextToPlainText(role.special);
  const specialBlocks = richTextToBlocks(role.special, { preserveLineBreaks: true });
  const hasSpecial = specialPlainText.trim().length > 0;
  const hasCitation = role.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((role.titre || localizeText("Sans nom")).toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const fontSize = BASE_TEXT_FONT_SIZE * textScale;
    const lineHeight = BASE_TEXT_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(descriptionText, DESCRIPTION_WIDTH, `italic 400 ${fontSize}px 'Courier Prime', monospace`) : 0;
    const rawCitationLines = hasCitation ? measureCitationLines(role.citation, SPECIAL_FRAME_WIDTH, `italic 700 ${fontSize}px 'Courier Prime', monospace`) : 0;
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
    const citationTop = hasSpecial ? specialFrameHeight + SPECIAL_CITATION_GAP : CITATION_SEPARATOR_GAP;
    const specialSectionHeight =
      (hasSpecial ? specialFrameHeight + (hasCitation ? 0 : SPECIAL_NO_CITATION_BOTTOM_GAP) : 0) +
      (hasCitation ? (hasSpecial ? SPECIAL_CITATION_GAP : CITATION_SEPARATOR_GAP) + citationHeight + SPECIAL_CITATION_BOTTOM_GAP : 0);

    return {
      citationHeight,
      citationLines,
      citationTop,
      descriptionBlockHeight,
      descriptionTop,
      descriptionHeight,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialFrameHeight,
      specialHeight,
      specialLines,
      specialSectionHeight,
      statsTop,
      titleFontSize,
      titleHeight,
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
    citationTop,
    descriptionBlockHeight,
    descriptionTop,
    descriptionHeight,
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
      style={{ width: CARD_VISIBLE_WIDTH * scale, height: CARD_VISIBLE_HEIGHT * scale, fontFamily: "'Courier Prime', 'Courier New', monospace" }}
      aria-label={localizeText(`Carte role cle ${role.titre || localizeText("sans nom")}`)}
    >
      <div
        className="relative h-[1039px] w-[744px] overflow-hidden bg-transparent"
        style={{
          transform: `scale(${scale}) translate(${-CARD_VISIBLE_X}px, ${-CARD_VISIBLE_Y}px)`,
          transformOrigin: "top left",
          ["--role-red" as string]: RED,
        }}
      >
        <div
          className="absolute bg-white"
          style={{
            left: CARD_FILL_X,
            top: CARD_FILL_Y,
            width: CARD_FILL_WIDTH,
            height: CARD_FILL_HEIGHT,
            borderRadius: 20,
          }}
        />
        <div
          className="absolute overflow-hidden rounded-[12px] shadow-[inset_0_0_20px_20px_#fff]"
          style={{ left: CARD_IMAGE_X, top: CARD_IMAGE_Y, width: CARD_IMAGE_WIDTH, height: CARD_IMAGE_HEIGHT }}
        >
          {localizeNode(role.image ? (
            <img src={role.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-35" />
          ) : (
            <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-zinc-100 via-white to-zinc-200 opacity-30" />
          ))}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_55px_38px_rgba(255,255,255,0.92)]" />
          <div className="absolute inset-0 bg-white/35" />
        </div>

        <HeaderBand />

        <div className="absolute left-[506px] top-[43px] flex h-[63px] items-center gap-2">
          <img
            src={heartPulseIcon}
            alt=""
            className="h-8 w-9 -translate-y-[4px] object-contain [filter:drop-shadow(0_0_10px_rgb(255_255_255_/_0.36))_drop-shadow(0_0_6px_rgb(255_255_255_/_0.58))_drop-shadow(0_0_3px_rgb(255_255_255_/_0.82))]"
            draggable={false}
          />
          <span className="role-glow text-[32px] font-bold leading-none text-[var(--role-red)]">{localizeText("PV:")}</span>
          <PvBox value={role.pv} />
        </div>

        <section
          className="absolute left-[42px] drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          style={{ top: TITLE_TOP, width: TITLE_WIDTH }}
        >
          <div
            className="role-glow overflow-hidden break-words font-bold uppercase tracking-normal text-black"
            style={{ height: titleHeight, fontSize: titleFontSize, lineHeight: `${titleLineHeight}px` }}
          >
            {role.titre || localizeText("Sans nom")}
          </div>
          {localizeNode(hasDescription && (
            <div className="relative border-y-4 border-[var(--role-red)]" style={{ marginTop: TITLE_DESCRIPTION_GAP, width: DESCRIPTION_WIDTH, height: descriptionBlockHeight }}>
              <p
                className="role-glow absolute left-0 m-0 overflow-hidden whitespace-pre-wrap break-words italic text-[var(--role-red)]"
                style={{
                  top: DESCRIPTION_TEXT_TOP,
                  width: DESCRIPTION_WIDTH,
                  height: descriptionHeight,
                  fontSize: textFontSize,
                  lineHeight: `${textLineHeight}px`,
                }}
              >
                {localizeNode(descriptionText)}
              </p>
            </div>
          ))}
        </section>

        <section className="absolute left-0 top-0">
          <div className="absolute left-[42px] space-y-[4px]" style={{ top: statsTop }}>
            <Stat label={localizeText("Corps")} value={role.corps} kind="corps" onRoll={onFacetRoll ? () => onFacetRoll("corps") : undefined} />
            <Stat label={localizeText("Esprit")} value={role.esprit} kind="esprit" onRoll={onFacetRoll ? () => onFacetRoll("esprit") : undefined} />
            <Stat label={localizeText("Ame")} value={role.ame} kind="ame" onRoll={onFacetRoll ? () => onFacetRoll("ame") : undefined} />
          </div>
          <div className="absolute left-[340px] w-[2px] bg-[var(--role-red)]" style={{ top: statsTop - 3, height: attributesBottomOffset }} />
          <div className="absolute left-[352px] space-y-[4px]" style={{ top: statsTop }}>
            <Stat label={localizeText("Armure")} value={role.armure} kind="armure" />
            {hasMultipleWeapons ? (
              <MultiDamageStat weapons={weapons} />
            ) : (
              <SingleDamageStat value={weapons[0].degats} weaponName={weapons[0].nom} />
            )}
          </div>
        </section>

        {(hasSpecial || hasCitation) && (
          <section
            className="absolute"
            style={{ left: SPECIAL_FRAME_X, top: specialTop, width: SPECIAL_FRAME_WIDTH, height: specialSectionHeight, color: SPECIAL_INK }}
          >
            {localizeNode(hasSpecial && (
              <>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 h-[32px] w-full overflow-visible"
                  viewBox={`0 0 ${SPECIAL_FRAME_WIDTH} ${SPECIAL_TOP_DECOR_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <path
                    d={`M2 29 L22 8 H${SPECIAL_FRAME_WIDTH - 22} L${SPECIAL_FRAME_WIDTH - 2} 29`}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    strokeWidth="6"
                  />
                </svg>
                <div
                  className="hidden"
                  style={{ left: SPECIAL_TITLE_LEFT, top: SPECIAL_TITLE_TOP, fontSize: textFontSize, lineHeight: `${textLineHeight}px` }}
                >{localizeText(" Capacités spéciales: ")}</div>
                <div
                  className="role-glow absolute w-[630px] overflow-hidden font-normal [&_em]:italic [&_i]:italic [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-[33px] [&_strong]:font-bold [&_u]:underline [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[28px] [&_li]:m-0 [&_li]:pl-[2px]"
                  style={{
                    left: SPECIAL_TEXT_LEFT,
                    top: SPECIAL_TEXT_TOP,
                    height: specialHeight,
                    fontSize: textFontSize,
                    lineHeight: `${textLineHeight}px`,
                  }}
                >
                  {specialBlocks.map((block, index) => (
                    <div key={index}>
                      {block.blank ? <br /> : <>
                        {block.listItem && <strong>{block.listKind === "ol" ? `${block.listIndex ?? 1}. ` : "\u2022 "}</strong>}
                        {block.runs.map((run, runIndex) => (
                          <span key={runIndex} style={{ fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? "italic" : "normal", textDecoration: run.underline ? "underline" : "none" }}>{run.text}</span>
                        ))}
                      </>}
                    </div>
                  ))}
                </div>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 h-[28px] w-full overflow-visible"
                  style={{ top: specialBottomTop }}
                  viewBox={`0 0 ${SPECIAL_FRAME_WIDTH} ${SPECIAL_BOTTOM_DECOR_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <path
                    d={`M2 3 L24 23 H${SPECIAL_FRAME_WIDTH - 24} L${SPECIAL_FRAME_WIDTH - 2} 3`}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    strokeWidth="6"
                  />
                </svg>
              </>
            ))}
            {localizeNode(hasCitation && !hasSpecial && (
              <div
                className="absolute left-[20px] h-[1px] bg-[var(--role-red)] opacity-70"
                style={{ top: citationTop - 5, width: SPECIAL_FRAME_WIDTH - 40 }}
              />
            ))}
            {hasCitation && (
              <p
                className="role-glow absolute left-0 m-0 w-full px-[6px] overflow-visible whitespace-pre-wrap break-words text-center font-bold italic"
                style={{ top: citationTop, height: citationHeight, fontSize: textFontSize, lineHeight: `${textLineHeight}px` }}
              >
                {role.citation}
              </p>
            )}
          </section>
        )}

        <Border />
      </div>
    </div>
  );
};

export default KeyRoleCard;
