# Activer et désactiver les comptes WAFOU

## Utilisation

Dans **Utilisateurs**, utiliser **Désactiver le compte** sur une ligne active, ou **Activer le compte** sur une ligne désactivée. L'action est aussi disponible dans la fiche de consultation. Saisir un motif de 3 à 1000 caractères, puis confirmer. Les libellés sont disponibles en FR/EN.

La commande exige `accounts.manage`, accordée au rôle administrateur global. Les lecteurs de comptes, agents support et lecteurs financiers ne reçoivent pas ce droit. La désactivation de son propre compte est interdite. Les comptes de démonstration, en attente ou dans un autre état protégé ne peuvent pas être activés par ce bouton.

## Effets et protections

Le statut applicatif passe de `active` à `suspended` ou inversement. Les contrôles serveur d'activité WAFOU réévaluent l'état du profil : un ancien jeton ne suffit plus pour effectuer des opérations exigeant un compte actif. La session admin est refusée lorsque le compte est désactivé.

Les données, rôles, réservations, missions et paiements existants sont conservés. Les modalités d'annulation ou d'incident d'une mission restent des procédures séparées. Les modifications de données d'un autre module ne sont pas déclenchées par cette action.

La suspension concerne l'accès applicatif WAFOU. Les jetons Supabase Auth peuvent subsister jusqu'à leur expiration ; le statut n'effectue pas de bannissement Auth ni de changement de mot de passe. Le profil propre minimal et le catalogue public restent accessibles selon leurs politiques existantes. Les futurs parcours client/prestataire doivent utiliser les mêmes vérifications d'activité pour les commandes sensibles.

Le serveur contrôle permission, auteur, version attendue, état courant et motif. Un verrou sérialise les changements ; l'administrateur est revérifié après acquisition du verrou. Les reprises avec le même identifiant et le même contenu retournent le résultat déjà enregistré ; une réutilisation avec un autre contenu est refusée. Le dialogue conserve la cible et sa version à l'ouverture pour éviter un changement d'intention après un rafraîchissement.

Un changement effectif produit une trace d'audit avec auteur/motif, un événement durable `EVT-018` et une notification interne `NTF-018` dans la langue du compte. Les répétitions n'ajoutent pas de notification. Aucun email/SMS/WhatsApp ni appel financier n'est émis. Le motif administratif reste dans l'audit et n'est pas copié dans l'événement destiné à la notification.

## Backend et vérification

Migration additive : `supabase/migrations/202610190008_account_status.sql`, après les migrations WAFOU existantes. RPC : `admin_set_account_status(p_profile_id,p_status,p_expected_version,p_reason,p_request_id)`. La cible est l'ID du profil ; l'identité de l'administrateur vient de la session, et les rôles clients ne peuvent pas écrire directement `account_status`.

Le registre de reprises est privé (`wafou_private.account_status_requests`). Les tables publiques restent au nombre de 42. La migration n'active ni ne désactive aucun compte existant.

Recette SQL transactionnelle : `supabase/tests/account_status.sql` (19 assertions, fixtures annulées). Tests navigateur : `apps/admin/tests/e2e/accounts.spec.ts` avec réponses API simulées. Aucun compte réel n'est utilisé par ces scénarios.
