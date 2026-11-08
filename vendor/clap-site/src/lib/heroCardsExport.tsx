import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Character } from "./characters";
import { renderHeroCardsA6PdfFromElements } from "./heroCardsA6Pdf";

// Mount the actual cards, exactly as the hero detail does, rather than redrawing their layout in PDF.
export async function renderHeroCardsA6PdfFromView(character: Character, { includeLinkedResources = true, includeBacks = true }: { includeLinkedResources?: boolean; includeBacks?: boolean } = {}): Promise<Blob> {
  const { CharacterCards } = await import("@/pages/CharacterEditor");
  const hero = includeLinkedResources ? character : { ...character, linkedResources: [] };
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:105mm;pointer-events:none";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await document.fonts?.ready;
    flushSync(() => root.render(<CharacterCards c={hero} activeCardTab="identity" />));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".hero-print-card"));
    if (!cards.length) throw new Error("Les cartes du héros n’ont pas pu être préparées pour l’export.");
    return await renderHeroCardsA6PdfFromElements(hero, cards, { includeBacks });
  } finally {
    root.unmount();
    container.remove();
  }
}
