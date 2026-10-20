# Disponibilités choisies par le prestataire

Décision du responsable, 20 octobre 2026 : les prestataires doivent pouvoir choisir leurs disponibilités. Cette capacité précise REQ-008 et UI-005. Chaque prestataire gère son propre agenda ; un administrateur ne choisit pas ses horaires à sa place.

Le socle livré permet de créer, modifier et retirer des plages datées avec heure de début, heure de fin et fuseau horaire. Plusieurs plages dans une journée sont possibles, par exemple 9 h–12 h et 14 h–17 h. Ne déclarer aucune plage signifie qu’aucune disponibilité n’est renseignée, et non une disponibilité permanente. Les changements ne créent, ne confirment ni n’annulent de réservation ou de mission.

## Capacités livrées

La table existante `availability_slots` et `provider_profiles.agenda_version` sont réutilisées. Les commandes authentifiées sont :

- `provider_availability(p_provider_id?)` : agenda propre lorsque l’identifiant est omis. Un administrateur disposant de `providers.read` peut consulter celui du prestataire indiqué. Réponse : `provider_id`, `agenda_version`, `slots` contenant les identifiants, débuts/fins ISO et fuseaux.
- `save_my_availability(p_expected_agenda_version, p_slot_id?, p_starts_at?, p_ends_at?, p_timezone?, p_remove=false)` : le prestataire est déduit de la session. Sans identifiant, création ; avec identifiant, modification ; avec identifiant et `p_remove=true`, retrait. Réponse : agenda complet et nouvelle version. Aucun identifiant d’un autre prestataire ne peut être fourni comme cible.

Les dates entrantes exigent un décalage explicite ou `Z`, par exemple `2026-11-02T09:00:00-05:00`, avec `America/Toronto` pour le fuseau d’affichage. Une heure locale sans décalage est refusée. Le futur frontend doit résoudre explicitement les heures ambiguës au changement d’heure, puis envoyer l’instant choisi. Les intervalles doivent être croissants et le fuseau connu de PostgreSQL.

La sauvegarde verrouille le profil prestataire et contrôle la version d’agenda. Un conflit renvoie `40001/STATE_CONFLICT` : relire avant de modifier à nouveau. Les répétitions identiques sont sans effet supplémentaire. Les plages contiguës sont admises ; les chevauchements de déclarations sont refusés pour éviter de représenter deux fois la même disponibilité. Aucune durée commerciale, délai de prévenance, horizon de réservation ou temps de trajet n’est imposé.

Le compte doit être actif et disposer d’un profil prestataire. Les écritures directes restent interdites. RLS protège la lecture privée ; ni un client ordinaire, ni un autre prestataire, ni un visiteur ne consulte l’agenda. Les changements réussis sont audités sans notification externe ni nouvel événement utilisateur.

Dans l’admin, **Prestataires → fiche → Disponibilités du prestataire** affiche les plages en heure locale et leur fuseau, avec la version de l’agenda. La consultation est disponible en FR/EN sur mobile. Un agenda vide et une erreur de chargement ont des affichages distincts.

Le dépôt contient actuellement `apps/admin`, sans PWA client/prestataire. Ce lot livre les commandes pour la gestion personnelle, les types TypeScript partagés et la consultation admin. **L’écran de saisie dans l’espace prestataire reste à construire avec la future PWA** ; l’accès à l’admin n’est pas accordé aux prestataires pour contourner cette absence.

## Points restant à valider

La répétition hebdomadaire, les exceptions et congés récurrents, les pauses/déplacements, les limites de durée et le verrouillage provisoire d’une réservation relèvent de Q-012 et restent **À VALIDER**. Une réservation future devra recalculer le créneau réellement réservable en tenant compte des occupations et vérifier les conflits au moment de l’engagement. Le présent lot ne livre pas ce moteur de réservation ni une projection publique des créneaux réservables.

Migration : `supabase/migrations/202610200012_provider_availability.sql`. Tests SQL : `supabase/tests/provider_availability.sql`. Types partagés : `packages/domain/src/availability.ts`. Écran : `apps/admin/src/ProviderAvailability.tsx`. Recette navigateur : `apps/admin/tests/e2e/provider-availability.spec.ts`.

La migration a été appliquée sur Supabase le 20 octobre 2026, après sauvegarde dont le catalogue a été vérifié. Les sept suites SQL passent 173 assertions en transaction annulée, dont 22 spécifiques aux disponibilités. Les six créneaux existants sont conservés ; aucun horaire n’est imposé à un prestataire. Les deux commandes refusent les appels HTTP anonymes. Une restauration complète de la sauvegarde et la recette d’une saisie dans la future PWA ne sont pas exécutées dans ce lot.

Validation du code : 22 tests unitaires réussis et build TypeScript/Vite réussi. Les trois scénarios navigateur de disponibilité (FR/EN et mobile, agenda vide, erreur serveur), les trois scénarios photo et la revue de toutes les listes/fiches FR/EN passent avec des réponses API synthétiques. La capture mobile a été inspectée. Aucun test avec un véritable compte prestataire dans une PWA n’est revendiqué. L’avertissement existant de taille du bundle demeure.
