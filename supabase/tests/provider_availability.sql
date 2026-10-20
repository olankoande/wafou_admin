BEGIN;
CREATE FUNCTION pg_temp.agenda_assert(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'AGENDA_TEST_FAILED: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.agenda_reject(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RAISE NOTICE 'PASS: %',label; RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'AGENDA_TEST_FAILED: accepted %',label;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('96000000-0000-4000-8000-000000000001','agenda-provider@example.invalid'),
 ('96000000-0000-4000-8000-000000000002','agenda-other@example.invalid'),
 ('96000000-0000-4000-8000-000000000003','agenda-client@example.invalid'),
 ('96000000-0000-4000-8000-000000000004','agenda-admin@example.invalid');
INSERT INTO public.profiles(user_id,account_status) SELECT id,'active' FROM auth.users WHERE id::text LIKE '96000000-%';
INSERT INTO public.provider_profiles(id,user_id) VALUES
 ('96000000-0000-4000-8000-000000000011','96000000-0000-4000-8000-000000000001'),
 ('96000000-0000-4000-8000-000000000012','96000000-0000-4000-8000-000000000002');
INSERT INTO public.user_roles(user_id,role) VALUES('96000000-0000-4000-8000-000000000004','admin');
SELECT pg_temp.agenda_assert(NOT has_function_privilege('anon','public.provider_availability(uuid)','EXECUTE'),'anonymous agenda access denied');
SELECT pg_temp.agenda_assert(NOT has_table_privilege('authenticated','public.availability_slots','INSERT') AND NOT has_table_privilege('authenticated','public.availability_slots','UPDATE') AND NOT has_table_privilege('authenticated','public.availability_slots','DELETE'),'direct agenda writes denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.agenda_assert(public.provider_availability()->'slots'='[]'::jsonb,'provider starts with empty availability');
SELECT pg_temp.agenda_assert((public.save_my_availability(1,NULL,'2026-11-02T09:00:00-05:00','2026-11-02T12:00:00-05:00','America/Toronto')->>'agenda_version')::int=2,'provider creates own dated availability');
SELECT pg_temp.agenda_assert((public.save_my_availability(1,NULL,'2026-11-02T09:00:00-05:00','2026-11-02T12:00:00-05:00','America/Toronto')->>'agenda_version')::int=2,'retry of same creation has no duplicate effect');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(1,NULL,'2026-11-03T09:00:00Z','2026-11-03T12:00:00Z','America/Toronto')$q$,'40001','stale agenda update rejected');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(2,NULL,'2026-11-02T09:00:00','2026-11-02T12:00:00','America/Toronto')$q$,'22023','ambiguous local timestamp rejected');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(2,NULL,'2026-11-03T12:00:00Z','2026-11-03T09:00:00Z','America/Toronto')$q$,'22023','reversed interval rejected');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(2,NULL,'2026-11-03T09:00:00Z','2026-11-03T12:00:00Z','Invalid/Timezone')$q$,'22023','invalid timezone rejected');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(2,NULL,'2026-11-02T10:00:00-05:00','2026-11-02T13:00:00-05:00','America/Toronto')$q$,'22023','overlapping declared availability rejected');
SELECT pg_temp.agenda_assert((public.save_my_availability(2,NULL,'2026-11-02T12:00:00-05:00','2026-11-02T15:00:00-05:00','America/Toronto')->>'agenda_version')::int=3,'adjacent availability is permitted');
SELECT pg_temp.agenda_assert((public.save_my_availability(3,(SELECT id FROM public.availability_slots WHERE starts_at='2026-11-02T14:00:00Z'),'2026-11-02T08:00:00-05:00','2026-11-02T12:00:00-05:00','America/Toronto')->>'agenda_version')::int=4,'provider edits own availability');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.agenda_assert((SELECT count(*)=0 FROM public.availability_slots WHERE provider_id='96000000-0000-4000-8000-000000000011'),'another provider cannot read private slots');
SELECT pg_temp.agenda_reject($q$SELECT public.provider_availability('96000000-0000-4000-8000-000000000011')$q$,'42501','another provider cannot inspect agenda RPC');
RESET ROLE;
SELECT set_config('test.agenda_slot',(SELECT id::text FROM public.availability_slots WHERE starts_at='2026-11-02T13:00:00Z' AND provider_id='96000000-0000-4000-8000-000000000011'),true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(1,current_setting('test.agenda_slot')::uuid,NULL,NULL,NULL,true)$q$,'42501','another provider cannot remove private slot');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000003',true);
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(1,NULL,'2026-11-03T09:00:00Z','2026-11-03T12:00:00Z','UTC')$q$,'42501','client without provider profile cannot declare availability');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000004',true);
SELECT pg_temp.agenda_assert(jsonb_array_length(public.provider_availability('96000000-0000-4000-8000-000000000011')->'slots')=2,'authorized administrator can inspect provider availability');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.agenda_assert((public.save_my_availability(4,current_setting('test.agenda_slot')::uuid,NULL,NULL,NULL,true)->>'agenda_version')::int=5,'provider removes own slot');
SELECT pg_temp.agenda_assert((public.save_my_availability(4,current_setting('test.agenda_slot')::uuid,NULL,NULL,NULL,true)->>'agenda_version')::int=5,'removal retry has no duplicate effect');
RESET ROLE;
SELECT pg_temp.agenda_assert((SELECT count(*)=4 FROM public.audit_logs WHERE actor_id='96000000-0000-4000-8000-000000000001' AND action IN ('availability.save','availability.remove')),'successful changes audited without duplicate retries');
UPDATE public.profiles SET account_status='suspended' WHERE user_id='96000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.agenda_reject($q$SELECT public.provider_availability()$q$,'42501','suspended provider cannot read agenda');
SELECT pg_temp.agenda_reject($q$SELECT public.save_my_availability(5,NULL,'2026-11-03T09:00:00Z','2026-11-03T12:00:00Z','UTC')$q$,'42501','suspended provider cannot change agenda');
RESET ROLE;
SELECT 'ALL PROVIDER AVAILABILITY ASSERTIONS PASSED; FIXTURES ROLLED BACK' AS result;
ROLLBACK;
