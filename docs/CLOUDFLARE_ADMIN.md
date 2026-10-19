# Admin — publication GitHub et futur déploiement Cloudflare

Date : 19 octobre 2026. Instruction du responsable : publier le module admin sur `olankoande/wafou_admin`, puis le déployer plus tard sur Cloudflare. Aucun déploiement ni changement de secrets n'est effectué dans ce lot.

## Périmètre publié

Application `apps/admin`, package `packages/domain`, manifests pnpm, README admin et ce guide. Les autres documents du projet restent locaux. Les scripts VPS, migrations, jeux de données, configuration locale et bundles compilés ne font pas partie de la publication frontend.

La compilation initiale a révélé deux utilisations du type générique `LockGrantedCallback` sans argument ; les tests utilisent maintenant `LockGrantedCallback<unknown>`. Le comportement applicatif reste identique.

## Configuration proposée pour Cloudflare Pages

La création du projet et le choix final Pages/Workers restent à effectuer lors de la mise en ligne. Pages peut servir le build statique existant sans ajouter de dépendance Cloudflare.

| Réglage | Valeur |
| --- | --- |
| Dépôt | `olankoande/wafou_admin` |
| Branche | `main` |
| Répertoire racine | Racine du dépôt, pas `apps/admin` (package workspace requis) |
| Commande de build | `pnpm install --frozen-lockfile && pnpm build` |
| Répertoire de sortie | `apps/admin/dist` |
| `NODE_VERSION` | `20.19.3` (version de vérification locale ; à revoir au déploiement) |
| `PNPM_VERSION` | `9.15.4` |
| `VITE_SUPABASE_URL` | URL HTTPS du backend de l'environnement choisi |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anon du même backend |

Les deux variables Vite sont incorporées au build : les configurer avant compilation et reconstruire après modification. Aucune clé service-role, mot de passe, connexion PostgreSQL ou secret JWT ne doit être fourni au frontend. Le fichier `.env.example` contient un emplacement factice pour la clé publique.

L'authentification Supabase et les permissions/RLS demeurent obligatoires, quel que soit le domaine Cloudflare. La publication statique ne crée ni backend, ni RPC, ni compte administrateur. Valider les origines et paramètres Auth pour le domaine final lors du déploiement, sans ouvrir globalement les accès.

## Vérifications et points ouverts

Résultats locaux : 7 tests unitaires réussis ; contrôle TypeScript et build Vite réussis via `pnpm --filter @wafou/admin test` et `pnpm --filter @wafou/admin build`. Vite signale un bundle JavaScript de 1,20 Mo (372 ko gzip), supérieur à son seuil d'avertissement de 500 ko. Le test Playwright utilise `WAFOU_ADMIN_EMAIL` et `WAFOU_ADMIN_PASSWORD` fournis dans l'environnement ; il n'est pas exécuté dans cette publication faute d'identifiants de recette fournis pour ce lot.

À valider lors de la mise en ligne : compte/projet Cloudflare, environnement Supabase cible, domaine, versions Node/pnpm alors supportées, connexion réelle, renouvellement de session, permissions par rôle, FR/EN, navigation mobile et retour à une version précédente. Aucun succès de déploiement ou de recette distante n'est déclaré ici.

## Références consultées

- [Configuration des builds Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/).
- [Monorepos Pages](https://developers.cloudflare.com/pages/configuration/monorepos/).
- [Environnement de build Pages](https://developers.cloudflare.com/pages/configuration/build-image/).
