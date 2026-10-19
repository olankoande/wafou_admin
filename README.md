# WAFOU

## Module admin — publication GitHub du 19 octobre 2026

Ce dépôt publie `apps/admin` et son package partagé `packages/domain`, en conservant l'organisation monorepo pnpm. Le module utilise React-Admin, Vite et TypeScript, avec authentification Supabase et permissions contrôlées côté serveur. Seul le catalogue propose actuellement des créations/modifications ; les autres ressources sont consultables selon habilitation.

Le déploiement Cloudflare est reporté à la demande du responsable. Aucun site Cloudflare n'est créé. Les réglages pour une future livraison Pages sont dans [CLOUDFLARE_ADMIN.md](docs/CLOUDFLARE_ADMIN.md).

Prérequis : Node compatible avec `engines` dans `package.json` et pnpm 9.15.4.

```sh
pnpm install --frozen-lockfile
```

Copier `apps/admin/.env.example` vers `apps/admin/.env`, puis renseigner uniquement l'URL et la clé publique anon Supabase. Exécuter depuis la racine :

```sh
pnpm dev:admin
pnpm test
pnpm build
```

Le serveur local écoute sur `http://127.0.0.1:5174` ; le build est produit dans `apps/admin/dist`. Les comptes admin doivent déjà être provisionnés et le backend doit exposer les RPC `admin_session`, `admin_dashboard` et `admin_save_service` ainsi que les tables et politiques RLS utilisées par le data provider. Ce dépôt frontend n'applique aucune migration et ne provisionne aucun compte.

Les scripts VPS, migrations, jeux de données, documentation interne du projet, fichiers .env et bundles compilés ne font pas partie de cette publication frontend.
