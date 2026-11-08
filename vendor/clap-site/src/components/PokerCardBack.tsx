import { localizeText, localizeNode } from '@/i18n/localize';
import { POKER_BACK_BACKGROUND, POKER_BACK_FONT, POKER_BACK_LABEL, POKER_BACK_LOGO, POKER_BACK_TITLE_MARGIN, pokerBackLogoY } from "@/lib/pokerCardBack";
import PokerCardFrame from "./PokerCardFrame";
import { pokerBackLabel, type PokerBackOptions } from "@/lib/pokerCardBack";

export default function PokerCardBack({ image = {} }: { image?: PokerBackOptions }) {
  const title = pokerBackLabel(image.backLabel ?? POKER_BACK_LABEL);
  const film = pokerBackLabel(image.backFilmTitle ?? "");
  return <PokerCardFrame label={localizeText(`Dos de carte ${title.text || "sans texte"}`)} color={image.borderColor}>
    <image href={image.backImage || POKER_BACK_BACKGROUND} width={63} height={88} preserveAspectRatio="xMidYMid slice" />
    <rect x={0} y={0} width={63} height={88} fill="black" fillOpacity={0.5} />
    <image href={POKER_BACK_LOGO} x={11.5} y={pokerBackLogoY(image.backFilmTitle)} width={40} height={40} data-back-logo />
    {localizeNode(film.text && <text x={31.5} y={POKER_BACK_TITLE_MARGIN} dominantBaseline="text-before-edge" textAnchor="middle" fontFamily={POKER_BACK_FONT} fontWeight={700} fontSize={film.size} fill="white" data-back-film-title>{localizeNode(film.text)}</text>)}
    {localizeNode(title.text && <text x={31.5} y={88 - POKER_BACK_TITLE_MARGIN} dominantBaseline="text-after-edge" textAnchor="middle" fontFamily={POKER_BACK_FONT} fontWeight={700} fontSize={title.size} fill="white" data-back-label>{localizeNode(title.text)}</text>)}
  </PokerCardFrame>;
}
