# Administration du catalogue, des tarifs et des frais

Le modèle courant est une boutique : [guide boutique](ADMIN_SHOP.md). Les fiches disposent d'icônes, d'unités/quantités et de forfaits ; la simulation multi-services complète le simulateur historique décrit ci-dessous. Le forfait global historique vaut pour une composition, le prix fixe boutique vaut pour une unité d'offre. Les deux modes conservent leurs règles distinctes.

## Écrans disponibles

- **Services** : contenu FR/EN, publication/retrait et motif de modification.
- **Pièces, options et types** : types de ménage, pièces/zones, options, tâches et fréquences. Paramétrage FR/EN, unité, quantités, pas, ordre et matériel/conditions.
- **Tâches et compatibilités** : relations « compris », « exclu », « incompatible avec » ou « nécessite », éventuellement limitées à un type de ménage.
- **Tarifs des prestations** : tarif global ou par pièce/option, type, fréquence et zone facultatifs, méthode, devise, valeurs et période de validité.
- **Frais de plateforme** : payeur, montant fixe, pourcentage ou combinaison, assiette, devise, périmètre, plancher/plafond et validité.
- **Historique des paramètres** : auteur, motif et versions précédentes/enregistrées, accessible aux auditeurs habilités.
- **Simulation de prix** : composition d'un panier et détail des tarifs/frais applicables, sans création de réservation ou paiement.

## Préparer une offre

Le catalogue initial comprend 10 pièces/zones, 15 options, 4 types de ménage, 4 fréquences et 23 tâches, tous en brouillon. Aucun prix ni taux de frais n'est initialisé. Les unités encore indécises restent vides. Les descriptions de départ sont à compléter avant publication commerciale.

1. Choisir le service et compléter les noms/descriptions FR/EN des composants.
2. Choisir les unités et quantités autorisées. Les quantités ont au plus trois décimales ; le pas doit être strictement positif.
3. Activer les composants nécessaires, puis leurs relations. Les tâches comprises/exclues sont des éléments réutilisables ; leur association dépend du périmètre de travail réellement promis.
4. Configurer les tarifs : prix par unité pour une pièce/option, forfait global, tarif horaire global ou devis. Un forfait/horaire global couvre les pièces ; les options restent chiffrées séparément. Aucun cumul forfait + tarifs de pièces déjà comprises.
5. Configurer explicitement les frais de chaque payeur. Si un côté ne paie aucun frais, enregistrer une règle de montant fixe zéro pour ce payeur ; l'absence de règle signifie non configuré.
6. Simuler un panier et vérifier les traductions, unités, tâches, montants et messages d'incomplétude.

Les champs monétaires se saisissent en dollars/euros selon la devise, avec deux décimales. Les pourcentages se saisissent de 0 à 100 avec deux décimales. La base stocke les montants en unités mineures et les pourcentages en points de base. CAD, USD et EUR sont supportés dans ce lot, sans conversion entre devises.

Les frais portent actuellement sur le sous-total des prestations hors taxes. Le calcul combine fixe et pourcentage, arrondit à l'unité mineure, puis applique le plancher et le plafond éventuels. Ces capacités ne sélectionnent aucune valeur commerciale. Les règles actives se chevauchant au même périmètre/période sont refusées ; aucune priorité ou remise implicite.

## Droits et historique

Les gestionnaires de catalogue utilisent `catalog.manage`. Les frais exigent `fees.manage`, accordée au rôle administrateur global et au rôle dédié `fee_manager` ; aucune affectation utilisateur supplémentaire n'est créée. Un simple lecteur `finance.read` ne modifie pas les frais. La simulation exige lecture catalogue et finance.

Toutes les écritures passent par une commande serveur ; les écritures directes sur les nouvelles tables sont interdites aux rôles applicatifs. Les configurations ne sont pas accessibles anonymement. Les changements exigent un motif et la version courante ; les éditions concurrentes sont refusées. Le service et la nature d'un composant sont conservés pour éviter de réinterpréter ses références. Retirer les règles actives dépendantes avant de retirer un composant ou de changer son unité.

Les versions des paramètres sont conservées dans `configuration_revisions`, sans mise à jour/suppression applicative. Les commandes de configuration acceptent une clé de reprise pour éviter les doublons après un résultat réseau incertain. Aucune suppression définitive n'est proposée dans les formulaires.

## Backend nécessaire

Les migrations additives `202610190004` à `202610190007` s'appliquent à la base WAFOU ayant déjà les migrations `202610180001` à `202610180003`. Elles ne constituent pas un bootstrap autonome d'une base vide.

Nouvelles tables : `catalog_components`, `catalog_links`, `catalog_rates`, `platform_fee_rules`, `configuration_revisions`. RPC : `admin_save_billing`, `admin_pricing_preview` et extension de `admin_save_service`. Le frontend utilise seulement URL et clé publique Supabase ; aucune clé privilégiée dans le build.

## Limites explicites

La simulation est administrative, calcule des montants avant taxes et retourne toujours un résultat non réservable. Les taxes, les factures fiscales, l'encaissement Stripe, les remboursements, le versement prestataire et les réservations récurrentes restent des lots distincts soumis aux décisions commerciales correspondantes. Une règle configurée n'effectue aucun paiement.

Les données et snapshots des réservations existantes ne sont pas réécrits. Le résultat de simulation contient les composants, tâches et versions de règles pour un futur parcours d'acceptation ; aucun nouveau workflow de réservation client n'est activé ici. Le catalogue public actuel des services reste distinct des nouveaux paramètres administratifs.

## Vérifications

Tests unitaires : `pnpm test`. Compilation/TypeScript : `pnpm build`. Tests navigateur simulés : `pnpm --filter @wafou/admin exec playwright test tests/e2e/billing.spec.ts`. Définir `PLAYWRIGHT_CHANNEL=msedge` pour utiliser Edge installé, ou installer le navigateur Chromium de Playwright. Les tests SQL du lot sont dans `supabase/tests/billing_catalog.sql` et utilisent une transaction annulée.
