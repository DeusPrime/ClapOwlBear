import { measureCitationLines } from '@/lib/resourceCitation';
import { localizeText, localizeNode } from '@/i18n/localize';
import PowerIcon from "@/components/PowerIcon";
import ResourceRollValue from "./ResourceRollValue";
import caseLong from "@/assets/power-card/case-long.svg";
import caseShort from "@/assets/power-card/case-short.svg";
import { Power } from "@/lib/powers";
import { estimatePlainTextLines, measurePlainTextLines, measureRichTextLines, richTextToHtml, richTextToPlainText } from "@/lib/richText";

const BLUE = "#032C4D";
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const CARD_CONTENT_BOTTOM = 1016;
const TITLE_TOP = 112;
const TITLE_WIDTH = 660;
const TITLE_DESCRIPTION_GAP = 21;
const TITLE_BASE_FONT_SIZE = 54;
const TITLE_BASE_LINE_HEIGHT = 62;
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

const CornerMarker = () => null;

const Tag = ({ children, wide = false }: { children: string; wide?: boolean }) => (
  <div className={`relative h-[63px] ${wide ? "w-[206px]" : "w-[129px]"}`}>
    <img src={wide ? caseLong : caseShort} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
    <div className="absolute inset-x-0 top-[9px] flex h-[42px] items-center justify-center text-center text-[24px] font-bold leading-none text-[var(--power-blue)]">
      {children}
    </div>
  </div>
);

const PowerCard = ({ power, scale = 1, onAttributeRoll }: { power: Power; scale?: number; onAttributeRoll?: () => void }) => {
  const hasDescription = power.description.trim().length > 0;
  const specialHtml = richTextToHtml(power.special);
  const limitationsHtml = richTextToHtml(power.limitations);
  const hasSpecial = richTextToPlainText(power.special).trim().length > 0;
  const hasLimitations = richTextToPlainText(power.limitations).trim().length > 0;
  const hasCitation = power.citation.trim().length > 0;
  const hasPowerSections = hasSpecial || hasLimitations;
  const titleText = (power.titre || localizeText("Sans nom")).toUpperCase();

  const measureBodyLayout = (textScale: number) => {
    const rawTitleLines = estimatePlainTextLines(titleText, Math.floor(TITLE_CHARS_PER_LINE / textScale));
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const titleHeight = rawTitleLines * titleLineHeight;
    const descriptionTop = TITLE_TOP + titleHeight + TITLE_DESCRIPTION_GAP;
    const descriptionFontSize = DESCRIPTION_BASE_FONT_SIZE * textScale;
    const descriptionLineHeight = DESCRIPTION_BASE_LINE_HEIGHT * textScale;
    const textClipSafety = 16 * textScale;
    const specialClipSafety = 8 * textScale;
    const citationClipSafety = 16 * textScale;
    const descriptionLines = hasDescription ? measurePlainTextLines(power.description, DESCRIPTION_TEXT_WIDTH, `italic 400 ${descriptionFontSize}px 'Courier Prime', monospace`) : 0;
    const descriptionHeight = descriptionLines * descriptionLineHeight + (hasDescription ? textClipSafety : 0);
    const descriptionBlockHeight = hasDescription ? descriptionHeight + DESCRIPTION_VERTICAL_CHROME : 0;
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
    const textBlockBottom = hasDescription ? descriptionTop + descriptionBlockHeight : TITLE_TOP + titleHeight;

    return {
      citationHeight,
      citationLines,
      citationTop,
      descriptionBlockHeight,
      descriptionFontSize,
      descriptionHeight,
      descriptionLineHeight,
      descriptionTop,
      sectionBodyHeight,
      specialFrameHeight,
      specialLines,
      limitationLines,
      specialSectionHeight,
      specialTop,
      titleFontSize,
      titleHeight,
      titleLineHeight,
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

  return (
    <div
      className="origin-top-left overflow-hidden"
      style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale, fontFamily: "'Courier Prime', 'Courier New', monospace" }}
      aria-label={localizeText(`Carte pouvoir ${power.titre || localizeText("sans nom")}`)}
    >
      <div
        className="relative h-[1039px] w-[744px] overflow-hidden rounded-[30px] bg-[var(--power-blue)] p-[18px] text-[var(--power-blue)]"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", ["--power-blue" as string]: BLUE }}
      >
        <div className="absolute inset-[18px] rounded-[18px] bg-white" />
        {localizeNode(power.image ? (
          <img src={power.image} alt="" className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] object-cover object-center opacity-35" draggable={false} />
        ) : (
          <div className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] bg-gradient-to-br from-white via-sky-50 to-orange-50" />
        ))}
        <div className="pointer-events-none absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] shadow-[inset_0_0_55px_38px_rgba(255,255,255,0.92)]" />
        <div className="absolute left-[18px] top-[18px] h-[1003px] w-[708px] rounded-[18px] bg-white/30" />

        <div className="absolute left-[17px] top-[17px] h-[74px] w-[345px] bg-[var(--power-blue)] text-white [clip-path:polygon(0_0,100%_0,91%_100%,0_100%)]">
          <div className="absolute left-[28px] top-[21px]"><PowerIcon size={35} /></div>
          <div className="absolute left-[92px] top-[22px] text-[34px] font-bold leading-none">{localizeText("Pouvoir")}</div>
          <div className="absolute left-[28px] right-[40px] top-[8px] border-t-[5px] border-dotted border-white/80" />
          <div className="absolute bottom-[8px] left-[28px] right-[40px] border-t-[5px] border-dotted border-white/80" />
        </div>

        <div className="absolute left-[372px] top-[25px] flex gap-[10px]">
          <Tag>{localizeNode(power.activation || "Actif")}</Tag>
          <div className="relative">
            {localizeNode(onAttributeRoll ? <ResourceRollValue tourTarget="roll-attribute" value={power.attribut || "Attribut"} color={BLUE} width={206} label={localizeText(`Utiliser le pouvoir avec ${power.attribut || "cet attribut"}`)} onClick={onAttributeRoll} /> : <Tag wide>{localizeNode(power.attribut || "Attribut")}</Tag>)}
          </div>
        </div>

        <div className="absolute left-[42px]" style={{ top: TITLE_TOP, width: TITLE_WIDTH }}>
          <div
            className="m-0 overflow-hidden break-words font-bold uppercase text-black drop-shadow-[0_4px_0_rgba(255,255,255,0.9)]"
            style={{ height: bodyLayout.titleHeight, fontSize: bodyLayout.titleFontSize, lineHeight: `${bodyLayout.titleLineHeight}px` }}
          >
            {localizeNode(titleText)}
          </div>
          {hasDescription && (
            <div
              className="relative border-y-2 border-[var(--power-blue)]"
              style={{
                marginTop: TITLE_DESCRIPTION_GAP,
                width: DESCRIPTION_WIDTH,
                height: bodyLayout.descriptionBlockHeight,
              }}
            >
              <p
                className="absolute left-0 m-0 overflow-hidden whitespace-pre-wrap break-words italic"
                style={{
                  top: DESCRIPTION_TEXT_TOP,
                  width: DESCRIPTION_TEXT_WIDTH,
                  height: bodyLayout.descriptionHeight,
                  fontSize: bodyLayout.descriptionFontSize,
                  lineHeight: `${bodyLayout.descriptionLineHeight}px`,
                }}
              >
                {power.description}
              </p>
            </div>
          )}
        </div>

        {(hasPowerSections || hasCitation) && (
          <div
            className="absolute"
            style={{ left: SPECIAL_FRAME_X, top: bodyLayout.specialTop, width: SPECIAL_FRAME_WIDTH, height: bodyLayout.specialSectionHeight }}
          >
            {localizeNode(hasPowerSections && (
              <>
                <svg aria-hidden="true" className="absolute left-0 top-0 h-[32px] w-full overflow-visible" viewBox="0 0 660 32" preserveAspectRatio="none">
                  <path d="M2 29 L22 8 H638 L658 29" fill="none" stroke="currentColor" strokeWidth="5" />
                </svg>
                <div className="absolute left-0 overflow-hidden" style={{ top: SPECIAL_TOP_DECOR_HEIGHT, width: SPECIAL_FRAME_WIDTH, height: bodyLayout.sectionBodyHeight }}>
                  {localizeNode(hasSpecial && (
                    <div className="relative">
                      <div className="font-bold" style={{ marginLeft: SECTION_TEXT_LEFT, fontSize: bodyLayout.textFontSize, lineHeight: `${bodyLayout.textLineHeight}px` }}>{localizeText("Effet")}</div>
                      <div
                        className="overflow-hidden break-words [&_em]:italic [&_i]:italic [&_strong]:font-bold [&_u]:underline"
                        style={{
                          marginLeft: SECTION_TEXT_LEFT,
                          width: SECTION_TEXT_WIDTH,
                          height: bodyLayout.specialLines * bodyLayout.textLineHeight,
                          fontSize: bodyLayout.textFontSize,
                          lineHeight: `${bodyLayout.textLineHeight}px`,
                        }}
                        dangerouslySetInnerHTML={{ __html: specialHtml }}
                      />
                    </div>
                  ))}
                  {localizeNode(hasLimitations && (
                    <div className="relative" style={{ marginTop: hasSpecial ? 14 : 0 }}>
                      <div className="font-bold" style={{ marginLeft: SECTION_TEXT_LEFT, fontSize: bodyLayout.textFontSize, lineHeight: `${bodyLayout.textLineHeight}px` }}>{localizeText("Limitation")}</div>
                      <div
                        className="overflow-hidden break-words [&_em]:italic [&_i]:italic [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-[33px] [&_strong]:font-bold [&_u]:underline [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-[28px] [&_li]:m-0 [&_li]:pl-[2px]"
                        style={{
                          marginLeft: SECTION_TEXT_LEFT,
                          width: SECTION_TEXT_WIDTH,
                          height: bodyLayout.limitationLines * bodyLayout.textLineHeight,
                          fontSize: bodyLayout.textFontSize,
                          lineHeight: `${bodyLayout.textLineHeight}px`,
                        }}
                        dangerouslySetInnerHTML={{ __html: limitationsHtml }}
                      />
                    </div>
                  ))}
                </div>
                <svg
                  aria-hidden="true"
                  className="absolute left-0 h-[32px] w-full overflow-visible"
                  style={{ top: SPECIAL_TOP_DECOR_HEIGHT + bodyLayout.sectionBodyHeight + SPECIAL_FRAME_BOTTOM_GAP }}
                  viewBox="0 0 660 32"
                  preserveAspectRatio="none"
                >
                  <path d="M2 3 L24 23 H636 L658 3" fill="none" stroke="currentColor" strokeWidth="5" />
                </svg>
              </>
            ))}
            {hasCitation && (
              <p
                className="absolute left-0 m-0 w-full px-[6px] overflow-visible whitespace-pre-wrap break-words text-center font-bold italic"
                style={{
                  top: bodyLayout.citationTop,
                  height: bodyLayout.citationHeight,
                  fontSize: bodyLayout.descriptionFontSize,
                  lineHeight: `${bodyLayout.descriptionLineHeight}px`,
                }}
              >
                « {power.citation} »
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PowerCard;
