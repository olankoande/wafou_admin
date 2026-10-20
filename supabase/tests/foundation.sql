-- Synthetic fixtures only; all changes are rolled back, including auth fixtures.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(condition boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'TEST_FAILED: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END $$;

SELECT pg_temp.assert_true((SELECT count(*)=42 FROM pg_tables WHERE schemaname='public'),'42 WAFOU tables including configurable billing');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)), 'all public tables RLS + FORCE');
SELECT pg_temp.assert_true((SELECT count(*)=2 AND bool_and(NOT public) FROM storage.buckets WHERE id LIKE 'wafou-%'),'two private buckets');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM wafou_private.business_configuration WHERE approved_at IS NOT NULL),'no invented approved business rules');
SELECT pg_temp.assert_true(NOT has_schema_privilege('anon','wafou_private','USAGE'),'anonymous cannot access private schema');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.user_roles','INSERT'),'no self role assignment');
SELECT pg_temp.assert_true(NOT has_column_privilege('authenticated','public.profiles','account_status','UPDATE'),'account status protected');
SELECT pg_temp.assert_true(NOT has_column_privilege('authenticated','public.provider_profiles','verification_reason','SELECT'),'private review reason hidden');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.ensure_my_profile(text)','EXECUTE'),'anonymous cannot bootstrap profile');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','wafou_private.record_event(text,text,text,uuid,integer,jsonb,uuid)','EXECUTE'),'event RPC server only');

INSERT INTO auth.users(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','client-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','client-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','provider@example.invalid'),
 ('10000000-0000-4000-8000-000000000004','bootstrap@example.invalid');
INSERT INTO public.profiles(user_id,display_name,account_status) VALUES
 ('10000000-0000-4000-8000-000000000001','TEST A','active'),
 ('10000000-0000-4000-8000-000000000002','TEST B','active'),
 ('10000000-0000-4000-8000-000000000003','TEST P','active');
INSERT INTO public.provider_profiles(id,user_id) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003');
INSERT INTO public.services(id,slug,name_fr,name_en,description_fr,description_en,status) VALUES
 ('30000000-0000-4000-8000-000000000001','test-only-public','TEST','TEST','TEST','TEST','published'),
 ('30000000-0000-4000-8000-000000000002','test-only-hidden','TEST','TEST','TEST','TEST',NULL);
INSERT INTO public.addresses(id,client_id,line1,city,province,postal_code,country_code) VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TEST','TEST','TEST','TEST','CA'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','TEST','TEST','TEST','TEST','CA');
INSERT INTO public.service_requests(id,client_id,service_id,address_id,needs,requested_start,requested_end,timezone) VALUES
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','{}','2030-01-01T10:00Z','2030-01-01T11:00Z','America/Toronto'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','{}','2030-01-01T10:00Z','2030-01-01T11:00Z','America/Toronto');
DO $$ BEGIN
 BEGIN
  INSERT INTO public.service_requests(client_id,service_id,address_id,needs,requested_start,requested_end,timezone)
  VALUES('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','{}',now(),now()+interval '1 hour','America/Toronto');
  RAISE EXCEPTION 'TEST_FAILED: cross-owner address accepted';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: cross-owner address rejected'; END;
 BEGIN
  INSERT INTO public.availability_slots(provider_id,starts_at,ends_at,timezone)
  VALUES('20000000-0000-4000-8000-000000000001',now(),now()+interval '1 hour','Invalid/Timezone');
  RAISE EXCEPTION 'TEST_FAILED: invalid timezone accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: invalid timezone rejected'; END;
END $$;
INSERT INTO public.assignments(id,request_id,provider_id,status) VALUES
 ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','accepted'),
 ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','accepted');
INSERT INTO public.bookings(id,request_id,assignment_id,price_snapshot,service_snapshot,amount_minor,currency,starts_at,ends_at,timezone) VALUES
 ('70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','{}','{}',100,'CAD','2030-01-01T10:00Z','2030-01-01T11:00Z','America/Toronto'),
 ('70000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','{}','{}',100,'CAD','2030-01-01T10:00Z','2030-01-01T11:00Z','America/Toronto');
INSERT INTO public.provider_occupancies(booking_id,provider_id,starts_at,ends_at,active)
VALUES('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2030-01-01T10:00Z','2030-01-01T11:00Z',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.provider_occupancies(booking_id,provider_id,starts_at,ends_at,active)
  VALUES('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','2030-01-01T10:30Z','2030-01-01T11:30Z',true);
  RAISE EXCEPTION 'TEST_FAILED: overlap accepted';
 EXCEPTION WHEN exclusion_violation THEN RAISE NOTICE 'PASS: overlapping occupancy rejected'; END;
END $$;

SET LOCAL ROLE anon;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.services WHERE slug LIKE 'test-only-%'),'anonymous sees published fixture service only');
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.profiles; RAISE EXCEPTION 'TEST_FAILED: anonymous private read';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous profile read denied'; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.profiles),'RLS client sees only own profile');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.addresses),'RLS client sees only own address');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.service_requests),'RLS client sees only own request');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.bookings),'RLS client sees only own booking');
UPDATE public.profiles SET display_name='TEST UPDATED' WHERE user_id=auth.uid();
SELECT pg_temp.assert_true((SELECT version=2 FROM public.profiles WHERE user_id=auth.uid()),'safe update increments version');
DO $$ BEGIN
 BEGIN UPDATE public.profiles SET account_status='admin' WHERE user_id=auth.uid(); RAISE EXCEPTION 'TEST_FAILED: status mutation';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: protected account status mutation denied'; END;
 BEGIN INSERT INTO public.user_roles(user_id,role) VALUES(auth.uid(),'admin'); RAISE EXCEPTION 'TEST_FAILED: privilege escalation';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: role self assignment denied'; END;
 BEGIN PERFORM 1 FROM public.booking_addresses; RAISE EXCEPTION 'TEST_FAILED: address projection bypass';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: booking private details closed'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
SELECT public.ensure_my_profile('en');
SELECT public.ensure_my_profile('en');
SELECT pg_temp.assert_true((SELECT count(*)=1 AND bool_and(account_status IS NULL) FROM public.profiles WHERE user_id=auth.uid()),'idempotent neutral profile bootstrap');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.user_roles),'bootstrap grants no role');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);

SET LOCAL ROLE service_role;
SELECT wafou_private.record_event('test:one','EVT-003','request','50000000-0000-4000-8000-000000000001',1,'{}','90000000-0000-4000-8000-000000000001');
SELECT wafou_private.record_event('test:one','EVT-003','request','50000000-0000-4000-8000-000000000001',1,'{}','90000000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.domain_events WHERE event_key='test:one'),'event idempotence');
DO $$ BEGIN
 BEGIN
  PERFORM wafou_private.record_event('test:one','EVT-003','request','50000000-0000-4000-8000-000000000001',1,'{"different":true}','90000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'TEST_FAILED: event key conflict accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: changed event payload rejected'; END;
END $$;
SELECT wafou_private.enqueue_notification((SELECT id FROM public.domain_events WHERE event_key='test:one'),'10000000-0000-4000-8000-000000000001','NTF-003',1,'fr');
SELECT wafou_private.enqueue_notification((SELECT id FROM public.domain_events WHERE event_key='test:one'),'10000000-0000-4000-8000-000000000001','NTF-003',1,'fr');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.notifications WHERE recipient_id='10000000-0000-4000-8000-000000000001'),'notification idempotence');
INSERT INTO public.event_processing(event_id,consumer) SELECT id,'test' FROM public.domain_events WHERE event_key='test:one';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM wafou_private.claim_event_jobs('test',1,60)),'worker claims due job');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM wafou_private.claim_event_jobs('test',1,60)),'leased job not claimed twice');
DO $$ BEGIN
 BEGIN
  PERFORM wafou_private.ack_event_job((SELECT id FROM public.event_processing WHERE consumer='test'),gen_random_uuid());
  RAISE EXCEPTION 'TEST_FAILED: stale worker acknowledged job';
 EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'PASS: stale worker token rejected'; END;
END $$;
SELECT wafou_private.ack_event_job(id,lease_token) FROM public.event_processing WHERE consumer='test';
SELECT pg_temp.assert_true((SELECT bool_and(status='done') FROM public.event_processing WHERE consumer='test'),'worker ack recorded');
RESET ROLE;
DO $$ BEGIN
 BEGIN UPDATE public.domain_events SET payload='{}' WHERE event_key='test:one'; RAISE EXCEPTION 'TEST_FAILED: event mutable';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: append-only event enforced'; END;
 BEGIN DELETE FROM public.audit_logs; RAISE EXCEPTION 'TEST_FAILED: audit mutable';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: append-only audit enforced'; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.notifications),'RLS client B cannot read A notifications');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT public.mark_notification_read(id) FROM public.notifications;
SELECT pg_temp.assert_true((SELECT bool_and(read_at IS NOT NULL) FROM public.notifications),'owner marks notification read');
RESET ROLE;
SELECT 'ALL FOUNDATION ASSERTIONS PASSED; FIXTURES WILL BE ROLLED BACK' AS result;
ROLLBACK;
