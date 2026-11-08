import type { TourStep } from '@/components/PageTour';

export type ResourceTourKind = 'key-role' | 'figurant' | 'power' | 'vehicle' | 'profile';

export function resourceTourSteps(kind: ResourceTourKind, canUse: boolean, en: boolean): TourStep[] {
  const tr = (fr: string, english: string) => en ? english : fr;
  const click = (target: string, title: string, body: string): TourStep => ({ target, title, body, tryAction: true });
  const steps: TourStep[] = [{ target: 'detail-actions', title: tr('Modifier et exporter', 'Edit and export'), body: tr('Le menu ⋮ permet de modifier cette carte et de l’exporter en PNG ou PDF.', 'The ⋮ menu lets you edit this card and export PNG or PDF.') }];
  if (kind === 'key-role') {
    for (const [facet, name, english] of [['corps', 'Corps', 'Body'], ['esprit', 'Esprit', 'Mind'], ['ame', 'Âme', 'Soul']]) {
      steps.push(click(`roll-${facet}`, tr(`Cliquer sur ${name}`, `Click ${english}`), tr(`Clique sur la valeur ${name} pour préparer un jet avec cette facette du rôle clé. « Essayer ce clic » ferme la visite et ouvre la fenêtre de jet.`, `Click the ${english} value to prepare a roll with this key role’s facet. “Try this click” ends the tour and opens the roll dialog.`)));
    }
  } else if (kind === 'figurant') {
    steps.push(click('roll-potential', tr('Cliquer sur le Potentiel', 'Click Potential'), tr('Clique sur la valeur de Potentiel pour préparer le jet du figurant. « Essayer ce clic » ferme la visite et ouvre la fenêtre de jet.', 'Click the Potential value to prepare the extra’s roll. “Try this click” ends the tour and opens the roll dialog.')));
  } else if (kind === 'power') {
    steps.push(canUse
      ? click('roll-attribute', tr('Utiliser l’attribut du pouvoir', 'Use the power’s attribute'), tr('Clique sur l’attribut en haut à droite de la carte : le jet utilisera cet attribut du héros. Le bouton « Utiliser » sous la carte ouvre le même jet. « Essayer ce clic » ferme la visite pour le préparer.', 'Click the attribute at the top right of the card to prepare a roll with that hero attribute. The Use button below the card opens the same roll. “Try this click” ends the tour to prepare it.'))
      : { target: 'detail-card', title: tr('Quand utiliser ce pouvoir ?', 'When can you use this power?'), body: tr('Le clic sur l’attribut est disponible pour un pouvoir actif ouvert depuis la fiche d’un héros. Ici, la carte se consulte : aucun jet n’est proposé sur l’attribut.', 'The attribute is clickable for an active power opened from a hero’s sheet. In this view the card is for reference; no attribute roll is available.') });
  } else if (kind === 'vehicle') {
    if (canUse) {
      steps.push(click('roll-handling', tr('Cliquer sur la Maniabilité', 'Click Handling'), tr('Clique sur la valeur de Maniabilité pour préparer ce jet de véhicule. Le bouton « Utiliser » sous la carte ouvre aussi ce jet. « Essayer ce clic » ferme la visite.', 'Click Handling to prepare this vehicle roll. The Use button below the card opens the same roll. “Try this click” ends the tour.')));
      steps.push(click('roll-speed', tr('Cliquer sur la Vitesse', 'Click Speed'), tr('Clique sur la valeur de Vitesse pour préparer un jet avec cette caractéristique. « Essayer ce clic » ferme la visite et ouvre la fenêtre de jet.', 'Click Speed to prepare a roll with this stat. “Try this click” ends the tour and opens the roll dialog.')));
    } else steps.push({ target: 'detail-card', title: tr('Utiliser ce véhicule avec un héros', 'Use this vehicle with a hero'), body: tr('Ouvre ce véhicule depuis la fiche d’un héros pour rendre Maniabilité et Vitesse cliquables. Depuis la liste des cartes, ces valeurs sont affichées pour consultation.', 'Open this vehicle from a hero’s sheet to make Handling and Speed clickable. From the card list, these values are shown for reference.') });
  } else {
    steps.push({ target: 'detail-card', title: tr('Lire le profil', 'Read the profile'), body: tr('Cette carte présente les caractéristiques et capacités du profil. Ses valeurs ne déclenchent pas de jet : utilise le menu ⋮ pour modifier son contenu.', 'This card shows the profile’s stats and abilities. Its values do not trigger rolls; use the ⋮ menu to edit its content.') });
  }
  steps.push({ target: 'detail-card', title: tr('Voir le verso', 'See the back'), body: tr('Glisse à gauche ou à droite sur la carte pour la retourner. Glisse à nouveau pour retrouver le recto et ses zones de clic.', 'Swipe left or right on the card to flip it. Swipe again to return to the front and its clickable areas.') });
  return steps;
}
