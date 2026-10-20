BEGIN;
CREATE FUNCTION pg_temp.assert_admin(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'ADMIN_TEST_FAILED: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
INSERT INTO auth.users(id,email) VALUES
 ('90000000-0000-4000-8000-000000000021','admin-test@example.invalid'),
 ('90000000-0000-4000-8000-000000000022','nonadmin-test@example.invalid');
INSERT INTO public.profiles(user_id,display_name,account_status) VALUES
 ('90000000-0000-4000-8000-000000000021','Admin test','active'),
 ('90000000-0000-4000-8000-000000000022','Non-admin test','active');
INSERT INTO public.user_roles(user_id,role) VALUES('90000000-0000-4000-8000-000000000021','admin');
SELECT pg_temp.assert_admin(NOT has_function_privilege('anon','public.admin_session()','EXECUTE'),'anonymous admin session denied');
SELECT pg_temp.assert_admin(NOT has_function_privilege('anon','public.admin_save_service(jsonb,uuid,integer)','EXECUTE'),'anonymous catalog mutation denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000022',true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_session(); RAISE EXCEPTION 'Non-admin session accepted';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: non-admin session denied'; END;
 BEGIN PERFORM public.admin_dashboard(); RAISE EXCEPTION 'Non-admin dashboard accepted';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: non-admin dashboard denied'; END;
 BEGIN PERFORM public.admin_save_service('{}'); RAISE EXCEPTION 'Non-admin mutation accepted';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: non-admin catalog mutation denied'; END;
END $$;
SELECT pg_temp.assert_admin((SELECT count(*)=0 FROM public.payments),'non-admin finance rows invisible');
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000021',true);
SELECT pg_temp.assert_admin((public.admin_session()->'permissions') ? 'catalog.manage','admin permissions server verified');
SELECT pg_temp.assert_admin((public.admin_dashboard()->>'profiles')::integer>=2,'admin dashboard returns permitted counts');
SELECT pg_temp.assert_admin((SELECT count(*)>0 FROM public.payments),'admin sees finance data');
SELECT pg_temp.assert_admin((SELECT count(*)>0 FROM public.provider_profiles),'admin sees providers');
DO $$ DECLARE record public.services; body jsonb:='{"slug":"admin-module-transaction-test","name_fr":"Test FR","name_en":"Test EN","description_fr":"Description FR","description_en":"Description EN","change_reason":"Synthetic service test"}';
BEGIN
 SELECT * INTO record FROM public.admin_save_service(body);
 PERFORM pg_temp.assert_admin(record.status='draft','new service remains unpublished');
 SELECT * INTO record FROM public.admin_save_service(body||'{"name_fr":"Updated FR"}',record.id,record.version);
 PERFORM pg_temp.assert_admin(record.name_fr='Updated FR' AND record.version=2,'catalog content update versioned');
 BEGIN PERFORM public.admin_save_service(body,record.id,1); RAISE EXCEPTION 'Stale write accepted';
 EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'PASS: stale catalog edit denied'; END;
 BEGIN PERFORM public.admin_save_service(body||'{"pricing_mode":"free"}'); RAISE EXCEPTION 'Protected field accepted';
 EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'PASS: direct pricing mode protected'; END;
 SELECT * INTO record FROM public.admin_save_service(body||'{"status":"published"}',record.id,record.version);
 PERFORM pg_temp.assert_admin(record.status='published','service publication explicitly versioned');
 BEGIN PERFORM public.admin_save_service(body||'{"change_reason":""}'); RAISE EXCEPTION 'Missing reason accepted';
 EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'PASS: service change reason required'; END;
END $$;
RESET ROLE;
SELECT 'ALL ADMIN ASSERTIONS PASSED; FIXTURES WILL BE ROLLED BACK' AS result;
ROLLBACK;
