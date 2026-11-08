# CLAP! pour Owlbear Rodeo

Prototype d’extension Owlbear Rodeo indépendant du site CLAP!, compatible avec le format `.clapStudio` version 1.

## Lancer en local

Node.js 22.12+ (ou 24 LTS) et npm sont nécessaires.

```powershell
npm.cmd ci
npm.cmd run dev
```

Ouvrir l’adresse affichée par Vite. L’aperçu autonome permet de tester l’import, la consultation des fiches et les jets locaux ; les échanges entre joueurs exigent une vraie salle Owlbear.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run preview
```

Si npm rencontre `UNABLE_TO_VERIFY_LEAF_SIGNATURE` sur Windows, utiliser le magasin de certificats système, sans désactiver la vérification TLS :

```powershell
$env:NODE_USE_SYSTEM_CA='1'
npm.cmd ci
```

## Installer dans Owlbear

1. Compiler avec `npm.cmd run build`.
2. Dans GitHub, ouvrir Settings > Pages et choisir **GitHub Actions** comme source. Le workflow `.github/workflows/pages.yml` publie `dist/` lors des push sur `main`.
3. Une fois le déploiement réussi, ajouter cette URL dans Owlbear : `https://deusprime.github.io/ClapOwlBear/manifest.json`, puis activer cette extension dans la salle.
4. Ouvrir le panneau CLAP! sur chaque navigateur participant.
5. Côté MJ : importer un `.clapStudio`, puis cliquer sur « Partager tout le projet dans la salle ».
6. Côté joueur : choisir un héros dans « Ma fiche », puis l’associer à son joueur.
7. Tester les messages et jets publics dans « Discussion ».

## Fonctions actuelles

- Lecture de l’archive ZIP `studio.json` exportée par le site ; vérification du format, de la version, des identifiants et de l’appartenance au projet.
- Dossier de projet **dans le panneau CLAP!**, héros, ressources et documents consultables. Les données non encore mises en page apparaissent avec leurs libellés techniques.
- Consultation des facettes et compétences des personnages ; association au compte du joueur par métadonnées Owlbear.
- Discussion en direct et jets génériques `NdF`, `NdF+bonus`, `NdF-bonus`, partagés dans la discussion.
- Tirage avec `crypto.getRandomValues` et rejet des valeurs créant un biais de modulo. Les jets sont calculés côté client : aucun mécanisme de certification anti-triche.
- Sauvegarde IndexedDB du projet, de la sélection et des 200 derniers messages, séparée par salle et navigateur.
- Partage explicite du projet par le MJ via Broadcast, découpé en petits messages sous la limite Owlbear de 16 Ko. Réception acceptée uniquement depuis une connexion identifiée comme MJ par Owlbear.

## Limites et confidentialité

**Le partage transmet l’intégralité du projet aux joueurs présents, y compris les notes et les documents. Préparer une copie sans secrets de MJ avant de partager.** L’import seul ne publie rien ; les demandes des joueurs ne déclenchent jamais de partage automatique.

- Prototype non encore validé dans une salle réelle à plusieurs joueurs. Compilation et tests unitaires ne remplacent pas cet essai.
- Le panneau doit rester ouvert pour recevoir le chat ou un projet. Les retardataires doivent demander un nouveau partage au MJ. Les messages manqués ne sont pas récupérés.
- Pas de stockage central : le cache local ne se synchronise pas entre appareils. La persistance partagée et l’historique commun seront une étape suivante.
- Import limité à 32 Mo compressés et décompressés ; transferts volumineux potentiellement lents. Pas de reprise automatique d’un transfert interrompu : le MJ peut relancer le partage.
- Les fiches sont consultables ; leur édition et les mécaniques propres aux dés CLAP! restent à ajouter.
- Pas encore d’import des images ou scènes dans les dossiers natifs de la bibliothèque Owlbear.
- La sélection d’une fiche est déclarative ; aucun verrou d’attribution exclusif n’est implémenté.
- Les push sur `main` publient cette extension sur GitHub Pages si Pages est activé. Aucun projet importé dans le navigateur ne fait partie de ce déploiement.

## Dépendances

Le SDK Owlbear 3.1 utilise `uuid` 9. Une surcharge ciblée vers `uuid` 11.1.1+ corrige l’avis de sécurité npm ; les usages SDK vérifiés sont les imports ESM de `v4()`, conservés par cette version. Valider aussi le SDK en salle réelle avant diffusion.

## Références

- [Extensions et manifeste](https://docs.owlbear.rodeo/extensions/getting-started/)
- [Broadcast : événements éphémères](https://docs.owlbear.rodeo/extensions/apis/broadcast/)
- [Joueurs et métadonnées](https://docs.owlbear.rodeo/extensions/apis/player/)
- [Import des images et scènes](https://docs.owlbear.rodeo/extensions/apis/assets/)
