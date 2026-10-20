# La fiche service comme point d’entrée

La navigation retenue le 20 octobre 2026 regroupe la configuration dans **Services → fiche du service**. Le menu conserve **Services** et **Zones d’intervention**. Les anciens menus de composants, associations et tarifs sont remplacés par les onglets de la fiche ; les données et anciennes routes restent disponibles pour compatibilité.

| Onglet | Usage |
| --- | --- |
| Informations | Consulter la fiche FR/EN, l’icône, les unités, quantités, inclusions/exclusions, disponibilité et composition des forfaits. Le bouton Modifier ouvre l’édition de ces informations. |
| Tarifs | Consulter, créer ou modifier les tarifs de ce service et de ses options, selon les droits. |
| Tâches comprises | Créer/modifier les tâches du service, puis sélectionner celles comprises dans son prix et enregistrer cette sélection avec un motif. |
| Options | Créer et modifier les suppléments propres au service : contenu FR/EN, unité, quantités et disponibilité. Leur prix se configure dans Tarifs. |
| Compatibilités | Définir les tâches comprises/exclues par un composant, incompatibilités et dépendances. Les types, fréquences et anciennes pièces restent accessibles dans les paramètres avancés. |

Les créations et modifications des éléments associés s’ouvrent dans une fenêtre au-dessus de la fiche. Le service est renseigné automatiquement et ne peut pas être changé dans ces formulaires. La nature est également fixée dans les onglets Tâches et Options. Les listes et les choix de références sont rattachés au service ; le backend conserve ses vérifications d’autorisation et de cohérence.

Après création d’un service, sa fiche devient le point de configuration. Les tâches peuvent commencer en brouillon ; les activer avant de publier une offre qui les inclut. Les contraintes de dépendance restent appliquées : une configuration active dépendante peut empêcher un retrait. Aucun prix ni frais commercial n’est choisi par cette réorganisation.

Les enregistrements utilisent les commandes existantes avec motif, version et historique. La sélection des tâches comprises actualise la fiche service avec sa version attendue. Les gestionnaires disposent des actions de création/modification ; les lecteurs gardent la consultation. L’onglet sélectionné figure dans l’URL et reste disponible après rechargement.

**Zones d’intervention** conserve les capacités existantes de consultation des secteurs géographiques. Le renommage n’ajoute pas de création de zones ni de moteur de vérification d’adresse.

Les libellés et les onglets sont disponibles en FR/EN. Sur mobile, la barre d’onglets défile horizontalement ; les tableaux larges défilent dans leur conteneur. Les frais de plateforme restent dans leur menu financier dédié, avec leur permission distincte.

Cette évolution concerne uniquement l’admin : aucune migration, modification des données existantes, notification externe ou mise en ligne Cloudflare. La recette automatisée est dans `apps/admin/tests/e2e/service-workspace.spec.ts`, avec réponses API synthétiques, en complément des tests de non-régression existants.
