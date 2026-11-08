import PageTour, { type TourStep } from './PageTour';
import { getLanguage } from '@/i18n/localize';

export default function ResourceEditorTour({ onStart }: { onStart: () => void }) {
  const en = getLanguage() === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const steps: TourStep[] = [
    { target: '.resource-edit-form > section:first-of-type', title: tr('Remplir le formulaire', 'Fill in the form'), body: tr('Renseigne les paramètres de ta carte dans le formulaire.', 'Fill in your card’s settings in the form.') },
    { target: 'editor-view-tabs', title: tr('Vérifier la carte', 'Check the card'), body: tr('L’aperçu se met à jour pendant la saisie. Sur mobile, touche Carte pour le voir et Édition pour revenir aux champs. Sur grand écran, il reste visible à droite.', 'The preview updates as you type. On mobile, tap Card to see it and Edit to return to the fields. On a large screen it stays visible on the right.') },
    { target: 'editor-save', title: tr('Enregistrer la carte', 'Save the card'), body: tr('Clique sur Sauver en haut de la page pour conserver tes changements.', 'Click Save at the top of the page to keep your changes.') },
  ];
  return <PageTour page="resource-edit" customSteps={steps} onStart={onStart} />;
}
