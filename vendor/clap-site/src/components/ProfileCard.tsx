import { measureCitationLines } from '@/lib/resourceCitation';
import { localizeText, localizeNode } from '@/i18n/localize';
import { Profile } from "@/lib/profiles";
import ProfileIcon from "@/components/ProfileIcon";
import facetIcon from "@/assets/profile-card/icone-facette.svg";
import traitsIcon from "@/assets/profile-card/icone-traits.svg";
import { estimatePlainTextLines, measurePlainTextLines } from "@/lib/richText";

const GREEN = "#005045";
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1039;
const CARD_CONTENT_BOTTOM = 1016;
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
const DESCRIPTION_CHARS_PER_LINE = 34;
const STATS_BLOCK_HEIGHT = 179;
const SPECIAL_FRAME_X = 42;
const SPECIAL_FRAME_WIDTH = 660;
const SPECIAL_TITLE_MARKER_LEFT = 14;
const SPECIAL_TITLE_MARKER_TOP = 25;
const SPECIAL_TITLE_MARKER_SIZE = 34;
const SPECIAL_TITLE_LEFT = 30;
const SPECIAL_TITLE_TOP = 29;
const SPECIAL_TEXT_LEFT = 24;
const SPECIAL_TEXT_TOP = 35;
const SPECIAL_FRAME_BOTTOM_GAP = 2;
const SPECIAL_BOTTOM_DECOR_HEIGHT = 28;
const SPECIAL_CITATION_GAP = 4;
const SPECIAL_CITATION_BOTTOM_GAP = 0;
const CITATION_SEPARATOR_GAP = 8;
const SPECIAL_CHARS_PER_LINE = 34;
const CITATION_CHARS_PER_LINE = 32;
const BASE_TEXT_FONT_SIZE = 34;
const BASE_TEXT_LINE_HEIGHT = 39;
const MIN_TEXT_SCALE = 0.02;

const OctBox = ({ value }: { value: string }) => (
  <div
    className="flex h-[56px] w-[92px] items-center justify-center bg-[var(--profile-green)] p-[6px] drop-shadow-[4px_5px_0_rgba(0,0,0,0.22)]"
    style={{ clipPath: "polygon(16% 0, 84% 0, 100% 28%, 100% 72%, 84% 100%, 16% 100%, 0 72%, 0 28%)" }}
  >
    <div
      className="role-glow flex h-full w-full items-center justify-center bg-white text-[30px] font-bold leading-none text-[var(--profile-green)]"
      style={{ clipPath: "polygon(16% 0, 84% 0, 100% 28%, 100% 72%, 84% 100%, 16% 100%, 0 72%, 0 28%)" }}
    >
      <span className="translate-y-[2px]">{localizeNode(value || "-")}</span>
    </div>
  </div>
);

const facetLabel = (label: string, fallback: string) => label.trim() || fallback;

const ProfileCard = ({ profile, scale = 1 }: { profile: Profile; scale?: number }) => {
  const hasDescription = profile.description.trim().length > 0;
  const hasSpecial = profile.special.trim().length > 0;
  const hasCitation = profile.citation.trim().length > 0;

  const measureTextLayout = (textScale: number) => {
    const titleFontSize = TITLE_BASE_FONT_SIZE * textScale;
    const titleLineHeight = TITLE_BASE_LINE_HEIGHT * textScale;
    const rawTitleLines = estimatePlainTextLines((profile.titre || localizeText("Sans nom")).toUpperCase(), Math.floor(TITLE_CHARS_PER_LINE / textScale));
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
      titleFontSize,
      titleHeight,
      titleLineHeight,
      fits: statsTop + STATS_BLOCK_HEIGHT <= specialTop,
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
    specialTop,
    statsTop,
    titleFontSize,
    titleHeight,
    titleLineHeight,
  } = textLayout;
  const textScale = textFontSize / BASE_TEXT_FONT_SIZE;

  return (
    <div
      className="origin-top-left overflow-hidden"
      style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale, fontFamily: "'Courier Prime', 'Courier New', monospace" }}
      aria-label={localizeText(`Carte profil ${profile.titre || localizeText("sans nom")}`)}
    >
      <div
        className="relative h-[1039px] w-[744px] overflow-hidden rounded-[30px] bg-[var(--profile-green)] p-[17px] text-[var(--profile-green)]"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", ["--profile-green" as string]: GREEN }}
      >
        <div className="absolute inset-[17px] rounded-[18px] bg-white" />
        {localizeNode(profile.image ? (
          <img src={profile.image} alt="" className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] object-cover object-center opacity-35" draggable={false} />
        ) : (
          <>
            <div className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] bg-[radial-gradient(circle_at_69%_20%,rgba(235,123,72,0.36),transparent_24%),conic-gradient(from_20deg_at_70%_23%,transparent_0deg,rgba(237,126,74,0.34)_70deg,transparent_105deg,rgba(237,126,74,0.26)_190deg,transparent_260deg)]" />
            <div className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] bg-white/45" />
            <div className="absolute bottom-[102px] left-[44px] h-[640px] w-[380px] bg-[linear-gradient(115deg,transparent_12%,rgba(30,35,36,0.28)_13%,rgba(30,35,36,0.28)_54%,transparent_55%),linear-gradient(65deg,transparent_18%,rgba(20,24,25,0.2)_19%,rgba(20,24,25,0.2)_48%,transparent_49%)] opacity-70 [clip-path:polygon(38%_0,58%_4%,70%_24%,86%_58%,98%_100%,12%_100%,22%_52%,30%_22%)]" />
          </>
        ))}
        <div className="pointer-events-none absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] shadow-[inset_0_0_55px_38px_rgba(255,255,255,0.92)]" />
        <div className="absolute left-[17px] top-[17px] h-[1005px] w-[710px] rounded-[18px] bg-white/30" />

        <div className="absolute left-[13px] top-[13px] h-[76px] w-[360px] bg-[var(--profile-green)] text-white [clip-path:polygon(0_0,100%_0,94%_100%,0_100%)]">
          <div className="absolute left-[31px] right-[44px] top-[8px] border-t-[5px] border-dotted border-white/85" />
          <div className="absolute bottom-[8px] left-[31px] right-[44px] border-t-[5px] border-dotted border-white/85" />
          <ProfileIcon size={34} className="absolute left-[31px] top-[23px]" />
          <div className="absolute left-[84px] top-[20px] w-[176px] text-center text-[42px] font-bold leading-none">{localizeText("Profil")}</div>
        </div>
        <div className="absolute left-[43px]" style={{ top: TITLE_TOP, width: TITLE_WIDTH }}>
          <div
            className="role-glow overflow-hidden break-words font-bold uppercase text-black"
            style={{ height: titleHeight, fontSize: titleFontSize, lineHeight: `${titleLineHeight}px` }}
          >
            {profile.titre || localizeText("Sans nom")}
          </div>
        </div>

        {hasDescription && (
          <div
            className="absolute left-[43px] border-y-2 border-[var(--profile-green)]"
            style={{ top: descriptionTop, width: DESCRIPTION_WIDTH, height: descriptionBlockHeight }}
          >
            <p
              className="role-glow absolute left-0 m-0 overflow-hidden whitespace-pre-wrap break-words italic"
              style={{
                top: DESCRIPTION_TEXT_TOP,
                width: DESCRIPTION_WIDTH,
                height: descriptionHeight,
                fontSize: textFontSize,
                lineHeight: `${textLineHeight}px`,
              }}
            >
              {profile.description}
            </p>
          </div>
        )}

        <div className="absolute left-[37px]" style={{ top: statsTop }}>
          <div className="grid items-center" style={{ gridTemplateColumns: "252px 1fr" }}>
            <div className="flex h-[63px] items-center gap-3 text-[32px] font-bold uppercase leading-none">
              <img src={facetIcon} alt="" className="h-[54px] w-[54px] shrink-0 object-contain" draggable={false} />
              <span className="role-glow translate-y-[3px]">{localizeText("FACETTES:")}</span>
            </div>
            <div className="flex gap-2 text-center">
              {[
                [facetLabel(profile.facetteForteLabel, "Forte"), profile.facetteForte],
                [facetLabel(profile.facetteNeutreLabel, "Neutre"), profile.facetteNeutre],
                [facetLabel(profile.facetteFaibleLabel, "Faible"), profile.facetteFaible],
              ].map(([label, value]) => (
                <div key={label} className="w-[92px]">
                  <OctBox value={value} />
                  <div className="role-glow mt-1 overflow-hidden break-words text-[18px] font-bold leading-none">{localizeNode(label)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-[10px] grid items-start" style={{ gridTemplateColumns: "252px 1fr" }}>
            <div className="flex h-[56px] items-center gap-2 text-[32px] font-bold uppercase leading-none">
              <img src={traitsIcon} alt="" className="h-[43px] w-[54px] shrink-0 object-contain" draggable={false} />
              <span className="role-glow translate-y-[3px]">{localizeText("TRAITS:")}</span>
            </div>
            <div className="flex gap-2 text-center">
              <div className="w-[92px]">
                <OctBox value={profile.traitPlus} />
                <div className="role-glow mt-[-2px] text-[34px] font-bold leading-none">+</div>
              </div>
              <div className="w-[92px]">
                <OctBox value={profile.traitMoins} />
                <div className="role-glow mt-[-2px] text-[34px] font-bold leading-none">-</div>
              </div>
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
                <svg aria-hidden="true" className="absolute left-0 h-[28px] w-full overflow-visible" style={{ top: specialBottomTop }} viewBox="0 0 660 32" preserveAspectRatio="none">
                  <path d="M2 3 L24 23 H636 L658 3" fill="none" stroke="currentColor" strokeWidth="5" />
                </svg>
                <div className="hidden">{localizeText("Capacites speciales:")}</div>
              </>
            ))}
            {localizeNode(hasSpecial && (
              <p
                className="role-glow absolute m-0 overflow-hidden whitespace-pre-wrap break-words"
                style={{
                  left: SPECIAL_TEXT_LEFT,
                  top: SPECIAL_TEXT_TOP,
                  right: SPECIAL_TEXT_LEFT,
                  height: specialHeight,
                  fontSize: textFontSize,
                  lineHeight: `${textLineHeight}px`,
                }}
              >
                {localizeNode(profile.special)}
              </p>
            ))}
            {localizeNode(hasCitation && !hasSpecial && (
              <div className="absolute left-[20px] h-[1px] bg-[var(--profile-green)] opacity-70" style={{ top: citationTop - 5, width: SPECIAL_FRAME_WIDTH - 40 }} />
            ))}
            {hasCitation && (
              <p
                className="role-glow absolute left-0 m-0 w-full px-[6px] overflow-visible whitespace-pre-wrap break-words text-center font-bold italic"
                style={{ top: citationTop, height: citationHeight, fontSize: textFontSize, lineHeight: `${textLineHeight}px` }}
              >
                {profile.citation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileCard;
