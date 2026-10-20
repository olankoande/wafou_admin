-- Transactional integration/RLS/financial configuration tests, rolled back in full.
BEGIN;
CREATE FUNCTION pg_temp.billing_assert(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'BILLING_TEST_FAILED: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.billing_reject(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RAISE NOTICE 'PASS: %',label; RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'BILLING_TEST_FAILED: accepted %',label;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('90000000-0000-4000-8000-000000000031','billing-admin@example.invalid'),
 ('90000000-0000-4000-8000-000000000032','billing-client@example.invalid'),
 ('90000000-0000-4000-8000-000000000033','billing-reader@example.invalid');
INSERT INTO public.profiles(user_id,account_status) VALUES
 ('90000000-0000-4000-8000-000000000031','active'),('90000000-0000-4000-8000-000000000032','active'),('90000000-0000-4000-8000-000000000033','active');
INSERT INTO public.user_roles(user_id,role) VALUES('90000000-0000-4000-8000-000000000031','admin'),('90000000-0000-4000-8000-000000000033','finance');
INSERT INTO public.services(id,slug,name_fr,name_en,description_fr,description_en) VALUES
 ('90000000-0000-4000-8000-000000000034','billing-transaction-test','Test','Test','Test','Test');
SELECT pg_temp.billing_assert(NOT has_function_privilege('anon','public.admin_save_billing(text,jsonb,uuid,integer,text,uuid)','EXECUTE'),'anonymous mutation denied');
SELECT pg_temp.billing_assert(NOT has_function_privilege('anon','public.admin_pricing_preview(jsonb)','EXECUTE'),'anonymous preview denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000032',true);
SELECT pg_temp.billing_assert((SELECT count(*)=0 FROM public.catalog_components),'client cannot read admin catalog drafts');
SELECT pg_temp.billing_reject($q$SELECT public.admin_save_billing('catalog_components','{}',NULL,NULL,'Test')$q$,'42501','client RPC mutation denied');
SELECT pg_temp.billing_reject($q$INSERT INTO public.catalog_components(service_id,slug,kind,name_fr,name_en) VALUES('90000000-0000-4000-8000-000000000034','attack','room','X','X')$q$,'42501','direct configuration write denied');
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000033',true);
SELECT pg_temp.billing_reject($q$SELECT public.admin_save_billing('platform_fee_rules','{}',NULL,NULL,'Test')$q$,'42501','finance reader cannot manage fees');
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000031',true);
DO $$
DECLARE service uuid:='90000000-0000-4000-8000-000000000034'; typ jsonb; room jsonb; extra jsonb; task jsonb;
 rate jsonb; fee jsonb; payload jsonb; cart jsonb; preview jsonb; saved_preview jsonb; global_rate jsonb;
BEGIN
 payload:=jsonb_build_object('service_id',service,'slug','regular','kind','cleaning_type','name_fr','Courant','name_en','Regular','description_fr','Test','description_en','Test','status','active');
 typ:=public.admin_save_billing('catalog_components',payload,p_reason=>'Test type');
 room:=public.admin_save_billing('catalog_components',payload||'{"slug":"bedroom","kind":"room","unit":"item"}',p_reason=>'Test room');
 extra:=public.admin_save_billing('catalog_components',payload||'{"slug":"oven","kind":"option","unit":"item"}',p_reason=>'Test option');
 task:=public.admin_save_billing('catalog_components',payload||'{"slug":"floor","kind":"task"}',p_reason=>'Test task');
 PERFORM pg_temp.billing_assert((room->>'version')::integer=1,'created configuration versioned');
 PERFORM pg_temp.billing_reject(format('SELECT public.admin_save_billing(''catalog_components'',%L::jsonb,%L,0,''Test stale'')','{"name_fr":"Other"}',room->>'id'),'40001','stale write rejected');
 PERFORM pg_temp.billing_reject($q$SELECT public.admin_save_billing('catalog_components','{"id":"90000000-0000-4000-8000-000000000099"}',NULL,NULL,'Test')$q$,'22023','protected fields rejected');
 PERFORM pg_temp.billing_reject($q$SELECT public.admin_save_billing('auth.users','{}',NULL,NULL,'Test')$q$,'22023','arbitrary table rejected');
 PERFORM pg_temp.billing_reject($q$SELECT public.admin_save_billing('catalog_components','{}',NULL,NULL,'')$q$,'22023','change reason required');
 cart:=jsonb_build_object('service_id',service,'cleaning_type_id',typ->>'id','currency','CAD','items',jsonb_build_array(jsonb_build_object('component_id',room->>'id','quantity',2)));
 preview:=public.admin_pricing_preview(cart);
 PERFORM pg_temp.billing_assert(preview->'issues' ? 'RATE_UNCONFIGURED' AND preview->'subtotal_minor'='null'::jsonb,'missing rate is not zero');
 payload:=jsonb_build_object('service_id',service,'component_id',room->>'id','cleaning_type_id',typ->>'id','name_fr','Test','name_en','Test','pricing_mode','unit','unit','item','currency','CAD','amount_minor',1001,'status','active');
 rate:=public.admin_save_billing('catalog_rates',payload,p_reason=>'Synthetic rate');
 PERFORM pg_temp.billing_reject(format('SELECT public.admin_save_billing(''catalog_rates'',%L::jsonb,NULL,NULL,''Duplicate test'')',payload::text),'23505','overlapping tariff rejected');
 preview:=public.admin_pricing_preview(cart);
 PERFORM pg_temp.billing_assert(preview->'issues' ? 'FEE_UNCONFIGURED_CLIENT','missing fees explicit');
 payload:=jsonb_build_object('service_id',service,'name_fr','Frais test','name_en','Test fee','description_fr','Test','description_en','Test','payer','client','basis','service_subtotal_excluding_tax','fee_mode','combined','fixed_minor',100,'percentage_bps',250,'currency','CAD','status','active');
 fee:=public.admin_save_billing('platform_fee_rules',payload,p_reason=>'Synthetic client fee');
 PERFORM public.admin_save_billing('platform_fee_rules',payload||'{"payer":"provider","fee_mode":"fixed","fixed_minor":0,"percentage_bps":null}',p_reason=>'Explicit zero provider fee');
 preview:=public.admin_pricing_preview(cart||'{"total_minor":1}');
 PERFORM pg_temp.billing_assert((preview->>'subtotal_minor')::bigint=2002 AND (preview->>'client_total_before_tax_minor')::bigint=2152,'server price and precise combined fee, client total ignored');
 PERFORM pg_temp.billing_assert((preview->>'pricing_complete')::boolean AND NOT (preview->>'bookable')::boolean AND preview->>'taxes_status'='unconfigured','simulation never creates a payable quote');
 saved_preview:=preview;
 PERFORM public.admin_save_billing('catalog_rates','{"amount_minor":2000}',(rate->>'id')::uuid,1,'Synthetic price change');
 PERFORM pg_temp.billing_assert((saved_preview->'lines'->0->'rate'->>'amount_minor')::integer=1001,'snapshot retains accepted rule version');
 PERFORM pg_temp.billing_reject(format('SELECT public.admin_pricing_preview(%L::jsonb)',(cart||jsonb_build_object('items',jsonb_build_array(jsonb_build_object('component_id',room->>'id','quantity',1.5))))::text),'22023','invalid quantity step rejected');
 PERFORM public.admin_save_billing('catalog_links',jsonb_build_object('service_id',service,'parent_id',room->>'id','child_id',task->>'id','relation','included','status','active'),p_reason=>'Room task');
 PERFORM public.admin_save_billing('catalog_links',jsonb_build_object('service_id',service,'parent_id',extra->>'id','child_id',task->>'id','relation','included','status','active'),p_reason=>'Option task');
 preview:=public.admin_pricing_preview(cart||jsonb_build_object('items',(cart->'items')||jsonb_build_array(jsonb_build_object('component_id',extra->>'id','quantity',1))));
 PERFORM pg_temp.billing_assert(preview->'issues' ? 'TASK_ALREADY_INCLUDED','included task not billed twice');
 PERFORM pg_temp.billing_reject(format('SELECT public.admin_save_billing(''catalog_components'',''{"status":"archived"}'',%L,1,''Archive dependency'')',room->>'id'),'22023','active dependencies protected');
 PERFORM pg_temp.billing_assert((SELECT count(*)>5 FROM public.configuration_revisions WHERE actor_id=auth.uid()),'immutable revisions recorded with actor');
 PERFORM pg_temp.billing_reject($q$UPDATE public.configuration_revisions SET reason='Changed'$q$,'42501','history cannot be overwritten');
 PERFORM public.admin_save_billing('catalog_rates','{"status":"archived"}',(rate->>'id')::uuid,2,'Archive unit tariff');
 payload:=jsonb_build_object('service_id',service,'name_fr','Forfait test','name_en','Test package','pricing_mode','fixed','unit','item','currency','CAD','amount_minor',5000,'status','active');
 global_rate:=public.admin_save_billing('catalog_rates',payload,p_reason=>'Global package test',p_request_id=>'90000000-0000-4000-8000-000000000035');
 PERFORM pg_temp.billing_assert(public.admin_save_billing('catalog_rates',payload,p_reason=>'Global package test',p_request_id=>'90000000-0000-4000-8000-000000000035')=global_rate,'idempotent retry returns same revision');
 PERFORM pg_temp.billing_reject(format('SELECT public.admin_save_billing(''catalog_rates'',%L::jsonb,NULL,NULL,''Global package test'',''90000000-0000-4000-8000-000000000035'')',(payload||'{"amount_minor":2}')::text),'23505','idempotency key body mismatch rejected');
 PERFORM public.admin_save_billing('catalog_rates',payload||jsonb_build_object('component_id',extra->>'id','pricing_mode','unit','amount_minor',900),p_reason=>'Separate extra price');
 preview:=public.admin_pricing_preview(cart||jsonb_build_object('items',(cart->'items')||jsonb_build_array(jsonb_build_object('component_id',extra->>'id','quantity',1))));
 PERFORM pg_temp.billing_assert(jsonb_array_length(preview->'lines')=2 AND (preview->'lines'->0->>'amount_minor')::integer=5000 AND (preview->'lines'->1->>'amount_minor')::integer=900,'global package covers rooms once and extras remain separate');
 PERFORM public.admin_save_billing('catalog_rates','{"status":"archived"}',(global_rate->>'id')::uuid,1,'Archive global package');
 PERFORM public.admin_save_billing('catalog_rates',payload||'{"pricing_mode":"hourly","unit":"hour","amount_minor":2000}',p_reason=>'Hourly synthetic rate');
 preview:=public.admin_pricing_preview(cart||'{"hours":1.25}');
 PERFORM pg_temp.billing_assert((preview->>'subtotal_minor')::integer=2500,'hourly pricing uses explicit hours');
END $$;
RESET ROLE;
SELECT pg_temp.billing_assert(NOT EXISTS(SELECT 1 FROM public.catalog_rates WHERE service_id=(SELECT id FROM public.services WHERE slug='home-cleaning')),'seed has no commercial prices');
SELECT 'ALL BILLING ASSERTIONS PASSED; FIXTURES ROLLED BACK' AS result;
ROLLBACK;
