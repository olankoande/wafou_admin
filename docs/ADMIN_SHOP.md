# Administration de la boutique de services

## Fiches et icônes

Dans **Services**, créer une fiche FR/EN, choisir **Proposer en boutique**, une icône et le type d'offre : service individuel ou forfait. Définir unité, quantités minimale/maximale, pas, ordre et prestations comprises/exclues. L'aperçu affiche l'icône avec le nom traduit.

Les 15 références d'icônes sont contrôlées côté serveur. Leur rendu utilise les pictogrammes MUI déjà installés, sans code libre ni téléchargement. Une référence ancienne inconnue affiche le pictogramme de ménage. Les clés stables sont partagées dans `packages/domain` pour le futur frontend ; le style pourra évoluer sans modifier les services.

Une nouvelle fiche commence en brouillon. La publication exige descriptions et inclusions FR/EN complètes, tâches actives et membres de forfait publiés. La disponibilité en boutique est indépendante de la publication : les anciens services ne deviennent pas automatiquement des articles.

Pour retirer un article, décocher sa disponibilité ou choisir **Retiré**. L'historique est conservé, sans suppression définitive. Un membre retiré rend aussi son forfait indisponible dans la projection publique et la simulation.

## Tâches, options et forfaits

Après enregistrement, créer les tâches/options dans **Pièces, options et types**, rattachées au service. Choisir ensuite les tâches comprises dans sa fiche. Les relations existantes précisent inclusions/exclusions, incompatibilités et options requises. Une option ne peut pas appartenir à un autre service.

Un forfait contient des services individuels et leurs quantités par unité de forfait. Les forfaits imbriqués sont refusés. Le prix du forfait est indépendant des prix de ses membres. Un forfait et son membre, ou deux forfaits qui se recouvrent, bloquent le chiffrage ; aucune réduction ou suppression de quantité n'est décidée silencieusement.

Les options du panier sont des quantités totales pour la ligne, sans multiplication implicite par le nombre de services.

## Tarifs et frais

Dans **Tarifs des prestations**, choisir le service et laisser **Pièce ou option** vide pour son prix principal. Un prix fixe boutique vaut pour une unité d'offre et est multiplié par sa quantité. L'unité du tarif doit correspondre à celle de la fiche. Configurer les options séparément.

Pour un tarif horaire : unité **Heure**, quantité et nombre d'heures identiques dans la simulation. Aucune durée automatique. Un devis reste sans total calculable ; une absence de tarif ou de frais ne devient pas zéro.

Les frais nécessitent `fees.manage`. Une règle globale s'applique une fois au sous-total du panier ; une règle par service s'applique une fois au sous-total de ce service, options comprises. Pourcentage, arrondi, plancher et plafond portent sur le sous-total agrégé couvert par chaque règle. L'absence de frais pour un payeur exige une règle explicitement à zéro. Aucune valeur commerciale n'est fournie.

## Simulation et futur frontend

**Simulation de prix** ouvre le panier multi-services, sans type de ménage obligatoire. **Ancien simulateur par pièces** conserve l'outil précédent. Le nouveau serveur vérifie quantités, unités, disponibilité, options, recouvrements et frais. Les résultats contiennent les versions et snapshots des services, membres, tâches et règles.

La simulation reste administrative : taxes non configurées, résultat non réservable, aucun paiement, notification ou nouvelle réservation. Les anciens engagements ne sont pas réécrits. La vérification de créneau, l'accord client et sa persistance restent à intégrer au futur parcours client.

La RPC publique `shop_catalog()` fournit les fiches boutique publiées et disponibles, leurs icônes, composants actifs et tarifs actifs courants avec leurs périmètres. Elle exclut brouillons, frais prestataire et audit. Le futur frontend doit respecter les conditions zone/type/fréquence des tarifs ; une règle conditionnelle ne définit pas un prix universel.

## Migration et vérifications

Les migrations additives `202610190009` et `202610190010` nécessitent le socle et les migrations précédentes jusqu'à `202610190008`. La seconde prépare 25 fiches individuelles et 41 tâches en brouillon à partir du catalogue existant, sans modifier celui-ci. Relire unités et contenus, notamment les unités provisoires **À l'unité** lorsqu'aucune unité n'avait été décidée. Aucun forfait commercial, tarif ou frais n'est créé.

Les écritures utilisent `admin_save_shop_service` avec permission serveur, RLS, version, motif, historique et clé de reprise. `admin_save_service` garde sa signature historique ; `admin_shop_preview` chiffre le panier. Le frontend ne contient que la clé publique Supabase.

Vérifications : `pnpm test`, `pnpm build`, `pnpm --filter @wafou/admin exec playwright test`. Utiliser `PLAYWRIGHT_CHANNEL=msedge` si nécessaire. Les tests SQL de `supabase/tests/service_shop.sql` annulent leurs données synthétiques ; les tests navigateur simulent le backend.
