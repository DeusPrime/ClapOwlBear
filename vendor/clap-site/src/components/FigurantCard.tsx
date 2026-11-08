import { measureCitationLines } from '@/lib/resourceCitation';
import { localizeText, localizeNode } from '@/i18n/localize';
import { Figurant } from "@/lib/figurants";
import ResourceRollValue from "./ResourceRollValue";
import figurantCase from "@/assets/figurant-card/case.svg";
import FigurantIcon from "@/components/FigurantIcon";
import iconArmureSvg from "@/assets/key-role-card/icone-armure.svg?raw";
import iconCorpsSvg from "@/assets/key-role-card/icone-corps.svg?raw";
import iconDegatsSvg from "@/assets/key-role-card/icone-degats.svg?raw";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToHtml, richTextToPlainText } from "@/lib/richText";

const BROWN = "#3a1b0c";
const roleIconDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replaceAll("#570211", BROWN))}`;
const iconArmure = roleIconDataUrl(iconArmureSvg);
const iconCorps = roleIconDataUrl(iconCorpsSvg);
const iconDegats = roleIconDataUrl(iconDegatsSvg);
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const PREVIEW_EDGE_BLEED = 2;
const CARD_CONTENT_BOTTOM = 1016;
const HEADER_LEFT = 16;
const HEADER_TOP = 17;
const TITLE_TOP = 112;
const TITLE_WIDTH = 660;
const TITLE_DESCRIPTION_GAP = 36;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 62;
const TITLE_CHARS_PER_LINE = 20;
const DESCRIPTION_WIDTH = 660;
const DESCRIPTION_TEXT_WIDTH = 650;
const DESCRIPTION_TEXT_TOP = 10;
const DESCRIPTION_VERTICAL_CHROME = 26;
const DESCRIPTION_STATS_GAP = 20;
const STATS_BLOCK_HEIGHT = 251;
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
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const DESCRIPTION_CHARS_PER_LINE = 34;
const SPECIAL_CHARS_PER_LINE = 34;
const CITATION_CHARS_PER_LINE = 32;
const MIN_TEXT_SCALE = 0.02;

const CornerMarker = () => null;

const ValueBox = ({ value }: { value: string }) => (
  <div className="relative h-[63px] w-[97px] text-[30px] font-bold">
    <img src={figurantCase} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
    <div className="role-glow absolute inset-x-0 top-[9px] flex h-[42px] items-center justify-center">
      {localizeNode(value || "-")}
    </div>
  </div>
);

const StatRow = ({ icon, label, value, nativeGlow = false, onRoll }: { icon: React.ReactNode; label: string; value: string; nativeGlow?: boolean; onRoll?: () => void }) => (
  <div className="flex h-[64px] items-center gap-4">
    <div className={`flex h-[44px] w-[44px] items-center justify-center ${nativeGlow ? "" : "[filter:drop-shadow(0_0_10px_rgb(255_255_255_/_0.36))_drop-shadow(0_0_6px_rgb(255_255_255_/_0.58))_drop-shadow(0_0_3px_rgb(255_255_255_/_0.82))]"}`}>{localizeNode(icon)}</div>
    <div className="role-glow flex h-[63px] w-[185px] shrink-0 items-center text-[32px] font-bold uppercase leading-none">{localizeNode(label)}:</div>
    {localizeNode(onRoll ? <ResourceRollValue tourTarget="roll-potential" value={value} color={BROWN} label={localizeText("Lancer le potentiel")} onClick={onRoll} /> : <ValueBox value={value} />)}
  </div>
);

const RoleAssetIcon = ({ src }: { src: string }) => (
  <img src={src} alt="" className="h-[45px] w-[45px] max-w-none object-contain" draggable={false} />
);

const WeaponBox = ({ name, value }: { name: string; value: string }) => (
  <div className="relative h-[107px] w-[97px] shrink-0">
    <ValueBox value={value} />
    {localizeNode(name.trim() && (
      <div className="role-glow absolute left-0 top-[68px] line-clamp-2 w-full break-words text-center text-[16px] font-bold leading-[17px]">
        {localizeNode(name)}
      </div>
    ))}
  </div>
);

const FigurantCard = ({ figurant, scale = 1, onPotentialRoll }: { figurant: Figurant; scale?: number; onPotentialRoll?: () => void }) => {
  const weapons = (figurant.armes.length ? figurant.armes : [{ nom: "", degats: "" }]).slice(0, 4);
  const hasDescription = figurant.description.trim().length > 0;
  const specialPlainText = richTextToPlainText(figurant.special);
  const specialHtml = richTextToHtml(figurant.special);
  const hasSpecial = specialPlainText.trim().length > 0;
  const hasCitation = figurant.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((figurant.titre || localizeText("Sans nom")).toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
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
      citationTop,
      descriptionBlockHeight,
      descriptionHeight,
      fontSize,
      lineHeight,
      specialBottomTop,
      specialFrameHeight,
      specialHeight,
      specialSectionHeight,
      statsTop,
      titleFontSize,
      titleHeight,
      titleLineHeight,
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
    citationTop,
    descriptionBlockHeight,
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
      style={{
        width: (CARD_WIDTH + PREVIEW_EDGE_BLEED) * scale,
        height: CARD_HEIGHT * scale,
        fontFamily: "'Courier Prime', 'Courier New', monospace",
        backgroundColor: BROWN,
        borderRadius: 30 * scale,
      }}
      aria-label={localizeText(`Carte figurant ${figurant.titre || localizeText("sans nom")}`)}
    >
      <div
        className="relative h-[1039px] overflow-hidden rounded-[30px] bg-[var(--figurant-brown)] text-[var(--figurant-brown)]"
        style={{
          width: CARD_WIDTH + PREVIEW_EDGE_BLEED,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          ["--figurant-brown" as string]: BROWN,
        }}
      >
        <div className="absolute left-0 top-0 h-full rounded-[30px] border-[18px] border-[var(--figurant-brown)]" style={{ width: CARD_WIDTH }} />
        <div className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] bg-white" />
        {localizeNode(figurant.image ? (
          <img src={figurant.image} alt="" className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] object-cover object-center opacity-35" />
        ) : (
          <div className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] bg-gradient-to-br from-zinc-50 via-white to-zinc-200" />
        ))}
        <div className="pointer-events-none absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] shadow-[inset_0_0_55px_38px_rgba(255,255,255,0.92)]" />
        <div className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] bg-white/35" />

        <div
          className="absolute h-[70px] w-[365px] bg-[var(--figurant-brown)] text-white [clip-path:polygon(0_0,100%_0,92%_100%,0_100%)]"
          style={{ left: HEADER_LEFT, top: HEADER_TOP }}
        >
          <div className="absolute left-[26px] top-[16px]">
            <FigurantIcon size={36} className="text-white" />
          </div>
          <div className="absolute left-[84px] top-[18px] w-[176px] text-center text-[34px] font-bold leading-none">{localizeText("Figurant")}</div>
          <div className="absolute left-[28px] right-[44px] top-[6px] border-t-[5px] border-dotted border-white/80" />
          <div className="absolute bottom-[7px] left-[28px] right-[44px] border-t-[5px] border-dotted border-white/80" />
        </div>

        <div className="absolute left-[42px]" style={{ top: TITLE_TOP, width: TITLE_WIDTH }}>
          <div
            className="role-glow overflow-hidden break-words font-bold uppercase text-black"
            style={{ height: titleHeight, fontSize: titleFontSize, lineHeight: `${titleLineHeight}px` }}
          >
            {figurant.titre || localizeText("Sans nom")}
          </div>
          {hasDescription && (
            <div className="relative border-y-2 border-[var(--figurant-brown)]" style={{ marginTop: TITLE_DESCRIPTION_GAP, width: DESCRIPTION_WIDTH, height: descriptionBlockHeight }}>
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
                {figurant.description}
              </p>
            </div>
          )}
        </div>

        <div className="absolute left-[42px] grid gap-2" style={{ top: statsTop }}>
          <StatRow icon={<RoleAssetIcon src={iconCorps} />} label={localizeText("Potentiel")} value={figurant.potentiel} nativeGlow onRoll={onPotentialRoll} />
          <StatRow icon={<RoleAssetIcon src={iconArmure} />} label={localizeText("Armure")} value={figurant.armure} nativeGlow />
          <div className="flex h-[107px] items-start gap-4">
            <div className="flex h-[63px] w-[44px] items-center justify-center">
              <RoleAssetIcon src={iconDegats} />
            </div>
            <div className="role-glow flex h-[63px] w-[185px] shrink-0 items-center text-[32px] font-bold uppercase leading-none">{localizeText("Degats:")}</div>
            <div className="flex gap-2">
              {weapons.map((weapon, index) => (
                <WeaponBox key={index} name={weapon.nom} value={weapon.degats} />
              ))}
            </div>
          </div>
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
              <div className="absolute left-[20px] h-[1px] bg-[var(--figurant-brown)] opacity-70" style={{ top: citationTop - 5, width: SPECIAL_FRAME_WIDTH - 40 }} />
            ))}
            {hasCitation && (
              <p
                className="role-glow absolute left-0 m-0 w-full px-[6px] overflow-visible whitespace-pre-wrap break-words text-center font-bold italic"
                style={{ top: citationTop, height: citationHeight, fontSize: textFontSize, lineHeight: `${textLineHeight}px` }}
              >
                {figurant.citation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FigurantCard;
