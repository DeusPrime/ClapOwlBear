# CLAP! pour Owlbear Rodeo — 0.2.16

Extension installée par manifeste et utilisée dans la salle Owlbear. Le moteur, les fiches et les outils de CLAP! proviennent du site, via une copie versionnée dans `vendor/clap-site`.

## Installation

Lien public : **https://deusprime.github.io/ClapOwlBear/manifest.json**

Cette version ajoute `background_url`. Faire recharger le manifeste dans Owlbear ; si la salle conserve l’ancien manifeste, réinstaller l’extension avec la même URL puis l’activer dans la salle. Un simple rafraîchissement de l’ancien panneau ne suffit pas si Owlbear n’a pas encore chargé le nouvel arrière-plan.

Chaque participant doit avoir l’extension active dans la salle. Le moteur d’arrière-plan du MJ crée automatiquement la partie, les joueurs la rejoignent avec leurs identités Owlbear distinctes. Aucun identifiant de salle CLAP!, compte du site ou mot de passe supplémentaire à saisir.

La fermeture du panneau ne ferme pas la partie : la page d’arrière-plan conserve la connexion tant que l’onglet Owlbear reste ouvert. Le MJ conserve l’état et les sauvegardes sur son navigateur ; les joueurs disposent de leur propre fiche et de leurs ressources locales.

## Transferts et animation locale 0.2.16

Les fragments déjà prêts sont regroupés avant compression, avec un plafond de 128 Ko UTF-8 et 64 trames. L’en-tête ne provoque plus un aller-retour seul. Sans carte liée à remapper, le joueur ne renvoie plus au MJ la fiche complète qu’il vient de recevoir ; les modifications ultérieures restent synchronisées. Le projet complet reste local au MJ ; le joueur reçoit sa fiche attribuée et les ressources liées. Les dés locaux disposent d’une image affichée avant la publication réseau ; une sécurité maintient l’envoi si le panneau passe en arrière-plan. Le test Chrome actionne le vrai bouton Lancer et vérifie que l’animation démarre avant la commande réseau.

## Cadence de transfert 0.2.15

Les envois natifs partagent une file cadencée entre les joueurs, données et confirmations comprises. Un refus SDK provoque une attente progressive avant réessai, au lieu de quatre tentatives immédiates puis fermeture. Le délai de confirmation commence après le dernier fragment envoyé ; le nombre de trames par lot reste dans la limite du récepteur. Des tests couvrent une fiche volumineuse sous quota simulé et un refus temporaire sans motif, avec conservation de la liaison.

## Cohérence présence et offres 0.2.14

Une offre reçue pendant la lecture des participants attend maintenant la lecture suivante. Elle ne peut plus être consommée avec une ancienne instance de présence, puis perdue avant la création de la liaison. Un test reproduit cette concurrence avec un joueur qui renouvelle sa session pendant une lecture du MJ. Un ancien refus de présence est effacé dès qu’une offre est acceptée.

## Fermeture de liaison 0.2.13

Les erreurs survenues pendant l’envoi ne sont plus masquées. Le diagnostic conserve l’étape (compression, chiffrement, envoi ou confirmation), le motif local ou distant de fermeture, les types de paquets et l’état interne de la boucle de connexion. Le message d’échec est aussi affiché dans la fenêtre d’attribution. Cela permet d’identifier un arrêt après une négociation réussie, au lieu de rester sur « En attente de connexion » sans explication.

## Diagnostic et négociation 0.2.12

Les offres de connexion sont confirmées et réessayées si un message ou une mise à jour de présence arrive en retard. Le joueur attend la confirmation du MJ avant d’annoncer une liaison ouverte ; le premier message d’ouverture est réessayé lui aussi. Les contrôles d’identité et le chiffrement restent utilisés.

En cas d’attente, **Copier le diagnostic connexion** dans la fenêtre d’attribution fournit les versions, le mode et les compteurs de négociation et de transport. Il ne contient ni fiches ni jetons de session. Le détail est aussi affiché dans l’onglet Héros tant qu’un participant n’est pas relié.

## Connexion et invités 0.2.11

Les parties natives transmettent maintenant les données par le bus d’Owlbear, sans dépendre d’une connexion WebRTC directe entre navigateurs. Les échanges sont chiffrés de bout en bout (ECDH et AES-GCM), découpés, accusés et réessayés si nécessaire ; les autres participants ne peuvent pas lire les fiches privées qui ne leur sont pas destinées.

Un invité en navigation privée reçoit une nouvelle identité Owlbear. Dans Mon héros, il choisit **Récupérer un héros → Demander au MJ**. Le MJ autorise la récupération dans Héros et la fiche conservée dans la salle reprend avec sa progression. Le nom seul ne donne aucun accès.

Le toast reçoit les données par le bus local d’Owlbear et confirme son affichage avant le décompte de fermeture. Une notification courte et un message de diagnostic remplacent un échec silencieux. Les URL du manifeste sont versionnées pour recharger les moteurs et les panneaux ; tous les participants doivent passer à cette version.

## Dés et notifications 0.2.10

Les jets publics apparaissent dans un toast graphique compact en bas à droite de la table, même quand le panneau CLAP! est fermé. Il reprend les silhouettes de dés et leurs animations, puis les couleurs et le score du résultat. Il s’efface automatiquement et laisse passer les clics sur la carte. Les jets privés ne l’ouvrent pas ; les détails restent dans la discussion. Les numéros de jets sont à nouveau reconnus après une remise à zéro de la salle.

## Correctif 0.2.9

L’import ne recalcule plus les stylisations et aperçus dans la page cachée : les originaux, les réglages et les rendus déjà présents sont conservés ; les rendus manquants seront générés à l’ouverture. La confirmation affiche l’étape en cours. Le moteur accuse réception des commandes et confirme son activité pendant leur exécution, ce qui évite l’échec systématique après deux minutes pour un import encore actif. Un moteur absent ou interrompu reste détecté.

## Correctif 0.2.8

Les affiches, leurs images originales et les fonds de projet sont désormais conservés dans IndexedDB. Les anciennes images sont migrées automatiquement au démarrage, avant d’alléger localStorage. Cela évite que la copie du projet dans une salle échoue avec « Espace de stockage insuffisant » lorsque ces images dépassent le quota localStorage. Les images et leurs réglages restent présents après rechargement et sont synchronisés entre le moteur et le panneau Owlbear.

## Interface

Le MJ utilise quatre onglets : Héros, Cartes, Ressources et Discussion. Le joueur dispose des onglets de sa fiche et de Discussion. Le coin supérieur droit contient uniquement le thème et le choix français / anglais.

Le projet se remplace uniquement dans **Gérer la salle → Changer de projet**. Après confirmation explicite, l’ancienne progression est supprimée : fiches attribuées, blessures, inventaires, cartes et PV, discussion et jets. Le nouveau projet est copié dans une salle propre ; les projets d’origine restent inchangés. Chaque participant doit recharger Owlbear après la mise à jour du protocole.

## Fonctions

- Interfaces et cartes interactives du site : identité, facettes, états, équipement, ressources, notes et jets CLAP!.
- Attribution des héros, propositions des joueurs, transferts de cartes et modifications d’inventaire, demandes de jets et réglages de visibilité.
- Chat public et murmures filtrés pour chaque destinataire. Les fiches complètes sont réservées au joueur concerné et au MJ.
- Bibliothèque, création et édition des héros et cartes, outils de composition et exports du site pour le MJ.
- Import `.clapStudio` depuis la gestion de salle ; le projet est copié dans la partie. Pas de limite globale de 32 Mo à cet import ; les validations des champs et ressources du site restent utilisées.
- Export **`.clapSalle`** depuis la gestion de salle ou la bibliothèque de sauvegardes. Le format est celui du site (`salle.json`, version 1), avec ses validations et sa limite de 64 Mo. Il n’inclut aucun jeton d’accès ou mot de passe. Il contient les données privées du MJ : le conserver et le partager en conséquence.
- Import et reprise d’une `.clapSalle` créée sur le site, depuis Import / export. Fermer la partie courante avant d’ouvrir une autre sauvegarde.
- Tentative de migration automatique des projets importés avec l’ancienne extension 0.1.x. L’ancien cache reste conservé ; une archive d’origine peut toujours être réimportée.

## Salles privées à Owlbear

Les salles hébergées par cette extension **ne sont jamais inscrites dans l’annuaire du site** : aucun appel à l’API de création ou de liste du site. La présence et la signalisation passent par Owlbear ; les données de jeu utilisent les connexions WebRTC du moteur CLAP!.

Deux modes sont disponibles :

1. **Partie locale Owlbear** : connexion automatique, sans inscription au serveur du site.
2. **Salle du site liée** : le MJ du site ouvre Gérer la salle → Relier Owlbear Rodeo et génère un code de liaison. Dans les réglages MJ de l’extension, coller ce code dans « Salle du site CLAP! ». Les joueurs Owlbear rejoignent automatiquement la même partie que les utilisateurs du site. La salle liée est masquée dans l’annuaire public.

Le code donne uniquement accès comme joueur. Pour utiliser les outils MJ depuis Owlbear, le MJ actuel transmet explicitement ce rôle au participant identifié « Owlbear » dans le menu existant du site. Les identités des invités Owlbear sont distinctes et privées à leur navigateur ; aucun compte ou cookie du site n’est transmis. Régénérer le code révoque le précédent.

**Activation de la liaison** : installer aussi la mise à jour du site et de son API. Le serveur doit annoncer `features.owlbearRooms: 1` sur `/api/health` ; l’extension refuse une ancienne API avant de fermer la partie Owlbear courante. Le dépôt du site prépare `release/clap-api-serveur.zip` et `release/clap-site.zip` via `npm run package:api`. Le réglage facultatif `OWLBEAR_ORIGIN` vaut par défaut `https://deusprime.github.io`. L’accès externe reste limité au protocole des salles ; comptes et administration conservent leur politique d’origine.

La configuration de liaison est lue depuis les métadonnées du MJ Owlbear authentifié, et non depuis les seules métadonnées partagées modifiables par les joueurs. Les codes d’entrée ne donnent aucun droit MJ et ne sont pas inclus dans les archives de partie.

Pour les parties locales, invitations et contrôle d’accès restent ceux d’Owlbear. Pour une salle liée, les contrôles du site sont conservés. Le MJ peut exclure un participant de CLAP!. Pour transmettre une partie locale, le successeur doit d’abord avoir le rôle MJ dans Owlbear ; l’interface ne propose que les successeurs autorisés. La partie CLAP! conserve un seul MJ actif, même avec plusieurs utilisateurs ayant le rôle GM Owlbear.

## Développement

Node.js 24 LTS recommandé.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd test
npm.cmd run build
node scripts/check-pages.mjs
```

L’aperçu local est sous `/ClapOwlBear/`. Hors Owlbear, l’entrée affiche les instructions d’installation. Pour les essais intégrés, ajouter le manifeste servi localement dans une salle de test.

Sous Windows, en cas d’erreur TLS npm, utiliser le magasin de certificats système sans désactiver la vérification :

```powershell
$env:NODE_USE_SYSTEM_CA='1'
npm.cmd ci
```

Pour reprendre les mises à jour du site :

```powershell
npm.cmd run sync:site -- "D:\jeu_de_role\Clap!!\Site\clap-cinematic-quest"
npm.cmd test
npm.cmd run build
```

Le script copie uniquement le code client et les ressources publiques, applique les chemins GitHub Pages et les adaptations de transport. Il ne copie ni serveur, ni `.env`, ni données utilisateur. `SOURCE.json` conserve la provenance et les empreintes des fichiers d’origine. `scripts/adapt-site.mjs` et `scripts/strict-site.mjs` rendent les adaptations explicites et reproductibles.

## Vérifications et limites

Les tests utilisent le vrai moteur et trois participants simulés : attribution, inventaire, messages publics, confidentialité des murmures et fiches, demandes de jets, export et réimport de la salle. Des tests distincts couvrent les rôles, la signalisation, la fermeture/réouverture du panneau et les projets de plus de 32 Mo.

Ces tests simulent le transport RTC. Une validation dans une vraie salle Owlbear avec plusieurs navigateurs reste nécessaire ; aucun test réel de connexion sur des réseaux distincts n’a encore été effectué. Les parties locales utilisent STUN et n’ajoutent pas de relais TURN : certains réseaux peuvent empêcher une connexion WebRTC directe. Une salle liée reprend les serveurs ICE/TURN fournis par l’API du site. Les quotas de stockage et la mémoire du navigateur restent applicables.

Le workflow GitHub Actions compile, teste, vérifie les fichiers et publie GitHub Pages à chaque push sur `main`.

Le MJ importe son projet .clapStudio directement dans la salle, depuis le panneau de preparation. Les heros et cartes alimentent automatiquement la reserve de la salle. Une sauvegarde .clapSalle preparee se reprend sans reimport.

Les blessures, inventaires, cartes et PV sont propres a la salle. Les ajouts de cartes creent une copie independante du projet source. Les jets publics declenchent une notification native Owlbear depuis le moteur en arriere-plan, meme panneau ferme ; les jets caches restent prives. Les mises a jour du panneau transmettent seulement les champs modifies, et les animations utilisent Web Animations pour eviter une boucle JavaScript par de.

Reconnexion : le lien entre le joueur et son heros est conserve par salle et compte Owlbear, meme apres fermeture de l?onglet. Avec le meme compte, le MJ restitue aussi la fiche sur un autre navigateur sans cache. Une absence temporaire du MJ laisse la session en attente au lieu de l?effacer. Le lien vers la salle Owlbear est facultatif : il est detecte depuis l?adresse parente quand elle est fournie, ou peut etre renseigne dans Import / export ; sans adresse, aucune reference au lien n?apparait dans la vue de salle.
