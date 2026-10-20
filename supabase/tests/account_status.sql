BEGIN;
CREATE FUNCTION pg_temp.account_assert(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'ACCOUNT_TEST_FAILED: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.account_reject(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RAISE NOTICE 'PASS: %',label; RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'ACCOUNT_TEST_FAILED: accepted %',label;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('90000000-0000-4000-8000-000000000091','status-admin@example.invalid'),
 ('90000000-0000-4000-8000-000000000092','status-user@example.invalid'),
 ('90000000-0000-4000-8000-000000000093','status-reader@example.invalid'),
 ('90000000-0000-4000-8000-000000000094','status-demo@example.invalid');
INSERT INTO public.profiles(id,user_id,account_status,locale) VALUES
 ('91000000-0000-4000-8000-000000000091','90000000-0000-4000-8000-000000000091','active','fr'),
 ('91000000-0000-4000-8000-000000000092','90000000-0000-4000-8000-000000000092','active','en'),
 ('91000000-0000-4000-8000-000000000093','90000000-0000-4000-8000-000000000093','active','fr'),
 ('91000000-0000-4000-8000-000000000094','90000000-0000-4000-8000-000000000094','demo_disabled','fr');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('90000000-0000-4000-8000-000000000091','admin'),('90000000-0000-4000-8000-000000000092','admin');
INSERT INTO wafou_private.role_permissions(role,permission) VALUES('test_account_reader','accounts.read');
INSERT INTO public.user_roles(user_id,role) VALUES('90000000-0000-4000-8000-000000000093','test_account_reader');
SELECT pg_temp.account_assert(NOT has_function_privilege('anon','public.admin_set_account_status(uuid,text,integer,text,uuid)','EXECUTE'),'anonymous account mutation denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000093',true);
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000092','suspended',1,'Test reason',gen_random_uuid())$q$,'42501','account reader cannot suspend');
SELECT pg_temp.account_reject($q$UPDATE public.profiles SET account_status='suspended' WHERE id='91000000-0000-4000-8000-000000000092'$q$,'42501','direct status write denied');
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000091',true);
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000091','suspended',1,'Test reason',gen_random_uuid())$q$,'22023','self deactivation denied');
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000092','suspended',1,'',gen_random_uuid())$q$,'22023','account change reason required');
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000094','active',1,'Test reason',gen_random_uuid())$q$,'22023','demo accounts cannot be activated');
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000092','suspended',0,'Test reason',gen_random_uuid())$q$,'40001','stale account write denied');
DO $$ DECLARE changed public.profiles; retry public.profiles; BEGIN
 changed:=public.admin_set_account_status('91000000-0000-4000-8000-000000000092','suspended',1,'Synthetic suspension','92000000-0000-4000-8000-000000000092');
 PERFORM pg_temp.account_assert(changed.account_status='suspended' AND changed.version=2,'deactivation versioned');
 retry:=public.admin_set_account_status('91000000-0000-4000-8000-000000000092','suspended',1,'Synthetic suspension','92000000-0000-4000-8000-000000000092');
 PERFORM pg_temp.account_assert(retry.version=2,'idempotent suspension retry');
 PERFORM pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000092','active',2,'Different request','92000000-0000-4000-8000-000000000092')$q$,'23505','reused key with different data denied');
END $$;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000092',true);
SELECT pg_temp.account_assert(NOT wafou_private.is_active() AND NOT wafou_private.has_permission('catalog.manage'),'existing JWT loses application privileges');
SELECT pg_temp.account_reject('SELECT public.admin_session()','42501','suspended admin session denied');
SELECT pg_temp.account_reject($q$SELECT public.admin_set_account_status('91000000-0000-4000-8000-000000000091','suspended',1,'Retaliatory action',gen_random_uuid())$q$,'42501','suspended administrator cannot disable another');
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000091',true);
DO $$ DECLARE changed public.profiles; BEGIN
 changed:=public.admin_set_account_status('91000000-0000-4000-8000-000000000092','active',2,'Synthetic activation',gen_random_uuid());
 PERFORM pg_temp.account_assert(changed.account_status='active' AND changed.version=3,'activation versioned');
 PERFORM pg_temp.account_assert((SELECT count(*)=2 FROM public.audit_logs WHERE target_id=changed.id AND action IN ('account.activate','account.deactivate')),'account actions audited');
END $$;
RESET ROLE;
SELECT pg_temp.account_assert((SELECT count(*)=1 FROM public.domain_events WHERE aggregate_id='91000000-0000-4000-8000-000000000092' AND aggregate_version=2),'single durable event for idempotent suspension');
SELECT pg_temp.account_assert((SELECT count(*)=2 AND bool_and(locale='en') FROM public.notifications WHERE recipient_id='90000000-0000-4000-8000-000000000092'),'deduplicated internal notifications follow locale');
SELECT pg_temp.account_assert(NOT EXISTS(SELECT 1 FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.recipient_id='90000000-0000-4000-8000-000000000092'),'no external delivery triggered');
SELECT pg_temp.account_assert((SELECT account_status='demo_disabled' FROM public.profiles WHERE id='91000000-0000-4000-8000-000000000094'),'unrelated account unchanged');
SELECT 'ALL ACCOUNT STATUS ASSERTIONS PASSED' AS result;
ROLLBACK;
