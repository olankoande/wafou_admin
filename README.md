# WAFOU

La boutique de services, ses icônes, forfaits et règles de panier sont décrits dans le [guide admin boutique](docs/ADMIN_SHOP.md).

La [revue du module admin](docs/ADMIN_REVIEW.md) décrit les corrections et les contrôles des écrans FR/EN et mobiles.

La [fiche service](docs/ADMIN_SERVICE_WORKSPACE.md) regroupe Informations, Tarifs, Tâches comprises, Options et Compatibilités. Les zones restent accessibles dans **Zones d’intervention**.

## Module admin — publication GitHub du 19 octobre 2026

Ce dépôt publie `apps/admin` et son package partagé `packages/domain`, en conservant l'organisation monorepo pnpm. Le module utilise React-Admin, Vite et TypeScript, avec authentification Supabase et permissions contrôlées côté serveur. L'admin permet de paramétrer les services, pièces, options, tâches, tarifs et frais de plateforme, de consulter leurs versions et de simuler un prix avant taxes. Les autres ressources métier restent consultables selon habilitation.

Le déploiement Cloudflare est reporté à la demande du responsable. Aucun site Cloudflare n'est créé. Les réglages pour une future livraison Pages sont dans [CLOUDFLARE_ADMIN.md](docs/CLOUDFLARE_ADMIN.md).

Le [guide du catalogue et des frais](docs/ADMIN_BILLING.md) décrit les écrans, droits, migrations nécessaires et limites de la simulation. Aucun tarif commercial ni taux de frais n'est prérempli ; aucune taxe ou opération Stripe n'est activée par cette configuration.

Les administrateurs habilités peuvent [activer et désactiver les comptes WAFOU](docs/ADMIN_ACCOUNTS.md) depuis la liste ou la fiche utilisateur, avec confirmation, motif et audit.

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

Le serveur local écoute sur `http://127.0.0.1:5174` ; le build est produit dans `apps/admin/dist`. Les comptes admin doivent déjà être provisionnés ; le backend doit disposer du socle WAFOU et des migrations de catalogue documentées dans le guide. Le frontend n'applique aucune migration et ne provisionne aucun compte.

Les migrations additives et tests SQL de catalogue accompagnent le module. Les scripts VPS, sauvegardes, données privées, spécifications internes, fichiers .env et bundles compilés sont exclus de la publication.

## Photos des comptes et prestataires

Le [guide photos et informations prestataire](docs/ADMIN_PHOTOS_KYC.md) décrit les photos privées facultatives, les droits et les capacités préparées pour le futur frontend. Aucune pièce d’identité n’est demandée pour le moment.
