# Code client CLAP! partagé

Copie versionnée du code et des ressources du dépôt `DeusPrime/clap-cinematic-quest`, utilisée pour conserver les mêmes fiches, outils, règles et formats de sauvegarde que le site.

Ne pas éditer ces fichiers isolément pour une évolution générale de CLAP!. Modifier le site d’origine puis lancer `npm run sync:site`. Les adaptations spécifiques à Owlbear sont décrites par les scripts `sync-site.mjs`, `adapt-site.mjs` et `strict-site.mjs` et les empreintes des sources d’origine par `SOURCE.json`.

Le transport HTTP du client de salle est remplacé par le service Owlbear et la façade de communication avec l’arrière-plan. Les invitations et permissions natives, les chemins de ressources et quelques annotations de types sont adaptés. Les composants de jeu et la structure `.clapSalle` restent ceux du site.
