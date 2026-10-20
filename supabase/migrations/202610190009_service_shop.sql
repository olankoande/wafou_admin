-- Service-shop metadata and read-only administrative cart pricing. No commercial values.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
SELECT pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));

ALTER TABLE public.services
 ADD COLUMN shop_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN offer_kind text NOT NULL DEFAULT 'individual' CHECK(offer_kind IN ('individual','bundle')),
 ADD COLUMN icon_key text NOT NULL DEFAULT 'cleaning' CHECK(icon_key IN ('cleaning','home','sofa','bed','kitchen','bathroom','toilet','office','stairs','laundry','oven','fridge','window','dishes','package')),
 ADD COLUMN unit text NOT NULL DEFAULT 'item' CHECK(unit IN ('item','hour','m2','window','load','bed','flight','module')),
 ADD COLUMN min_quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK(min_quantity>0 AND min_quantity<=100000),
 ADD COLUMN max_quantity numeric(12,3) CHECK(max_quantity>=min_quantity AND max_quantity<=100000),
 ADD COLUMN quantity_step numeric(12,3) NOT NULL DEFAULT 1 CHECK(quantity_step>0 AND quantity_step<=100000),
 ADD COLUMN sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 100000),
 ADD COLUMN included_fr text NOT NULL DEFAULT '', ADD COLUMN included_en text NOT NULL DEFAULT '',
 ADD COLUMN excluded_fr text NOT NULL DEFAULT '', ADD COLUMN excluded_en text NOT NULL DEFAULT '',
 ADD COLUMN included_task_ids uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN bundle_items jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(bundle_items)='array' AND jsonb_array_length(bundle_items)<=100),
 ADD CONSTRAINT individual_without_bundle CHECK(offer_kind='bundle' OR bundle_items='[]'::jsonb);
CREATE INDEX services_shop_order ON public.services(sort_order,id) WHERE shop_enabled AND status='published';

CREATE FUNCTION public.admin_save_shop_service(p_data jsonb,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT NULL,p_request_id uuid DEFAULT NULL)
RETURNS public.services LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.services; result public.services; merged jsonb; allowed text[]; cols text; assignments text;
 field text; reason text; entry jsonb; member public.services; seen uuid[]:='{}'; task_id uuid; prior public.configuration_revisions;
BEGIN
 IF NOT wafou_private.has_permission('catalog.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>50000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE'; END IF;
 allowed:=ARRAY['slug','name_fr','name_en','description_fr','description_en','status','shop_enabled','offer_kind','icon_key','unit','min_quantity','max_quantity','quantity_step','sort_order','included_fr','included_en','excluded_fr','excluded_en','included_task_ids','bundle_items'];
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF field<>'change_reason' AND NOT field=ANY(allowed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PROTECTED_FIELD'; END IF;
 END LOOP;
 reason:=p_data->>'change_reason';
 IF reason IS NULL OR length(btrim(reason)) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANGE_REASON_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
 -- Recheck after serialization, including a revoked or disabled actor.
 IF NOT wafou_private.has_permission('catalog.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_request_id IS NOT NULL THEN
  SELECT * INTO prior FROM public.configuration_revisions WHERE request_id=p_request_id;
  IF FOUND THEN
   IF prior.actor_id IS DISTINCT FROM auth.uid() OR prior.resource<>'services' OR prior.request_data IS DISTINCT FROM jsonb_build_object('data',p_data,'id',p_id,'version',p_expected_version) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_populate_record(NULL::public.services,prior.after_data);
  END IF;
 END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO previous FROM public.services WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF p_expected_version IS NULL OR previous.version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 END IF;
 merged:=CASE WHEN p_id IS NULL THEN jsonb_build_object('status','draft','shop_enabled',false,'offer_kind','individual','included_task_ids','[]'::jsonb,'bundle_items','[]'::jsonb) ELSE to_jsonb(previous) END || p_data;
 FOREACH field IN ARRAY ARRAY['min_quantity','max_quantity','quantity_step','sort_order'] LOOP
  IF merged ? field AND merged->field<>'null'::jsonb AND (jsonb_typeof(merged->field)<>'number' OR scale((merged->>field)::numeric)>CASE WHEN field='sort_order' THEN 0 ELSE 3 END) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['slug','name_fr','name_en','description_fr','description_en'] LOOP
  IF jsonb_typeof(merged->field) IS DISTINCT FROM 'string' OR btrim(merged->>field)='' OR length(merged->>field)>10000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE_FIELD'; END IF;
 END LOOP;
 IF merged->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR merged->>'status' IS NULL OR merged->>'status' NOT IN ('draft','published','archived') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE_FIELD'; END IF;
 IF jsonb_typeof(merged->'bundle_items') IS DISTINCT FROM 'array' OR jsonb_array_length(merged->'bundle_items')>100 OR jsonb_typeof(merged->'included_task_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(merged->'included_task_ids')>100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE_SCOPE'; END IF;
 IF merged->>'offer_kind'='individual' AND merged->'bundle_items'<>'[]'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_BUNDLE'; END IF;
 IF merged->>'offer_kind'='bundle' AND EXISTS(SELECT 1 FROM public.services s CROSS JOIN LATERAL jsonb_array_elements(s.bundle_items) x WHERE x->>'service_id'=p_id::text) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='NESTED_BUNDLE'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(merged->'bundle_items') LOOP
  IF jsonb_typeof(entry)<>'object' OR (entry-'service_id'-'quantity')<>'{}'::jsonb OR jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_BUNDLE'; END IF;
  SELECT * INTO member FROM public.services WHERE id=(entry->>'service_id')::uuid;
  IF NOT FOUND OR member.id=p_id OR member.id=ANY(seen) OR member.offer_kind<>'individual' OR NOT member.shop_enabled OR
   (entry->>'quantity')::numeric<=0 OR (entry->>'quantity')::numeric>100000 OR scale((entry->>'quantity')::numeric)>3 OR
   (entry->>'quantity')::numeric<member.min_quantity OR (entry->>'quantity')::numeric>coalesce(member.max_quantity,100000) OR mod((entry->>'quantity')::numeric-member.min_quantity,member.quantity_step)<>0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_BUNDLE'; END IF;
  IF merged->>'status'='published' AND (merged->>'shop_enabled')::boolean AND member.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INACTIVE_BUNDLE_MEMBER'; END IF;
  seen:=array_append(seen,member.id);
 END LOOP;
 FOREACH task_id IN ARRAY ARRAY(SELECT jsonb_array_elements_text(merged->'included_task_ids')::uuid) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.catalog_components WHERE id=task_id AND service_id=p_id AND kind='task' AND (merged->>'status'<>'published' OR NOT (merged->>'shop_enabled')::boolean OR status='active')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COMPONENT_REFERENCE'; END IF;
 END LOOP;
 IF merged->>'status'='published' AND (merged->>'shop_enabled')::boolean THEN
  IF btrim(coalesce(merged->>'included_fr',''))='' OR btrim(coalesce(merged->>'included_en',''))='' OR (merged->>'offer_kind'='bundle' AND jsonb_array_length(merged->'bundle_items')=0) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INCOMPLETE_SHOP_SERVICE'; END IF;
 END IF;
 SELECT string_agg(format('%I',a),','),string_agg(format('%I=x.%I',a,a),',') INTO cols,assignments FROM unnest(allowed) a WHERE p_data ? a;
 IF p_id IS NULL THEN
  IF NOT p_data ? 'status' THEN cols:=cols||',status'; END IF;
  EXECUTE format('INSERT INTO public.services(%s) SELECT %s FROM jsonb_populate_record(NULL::public.services,$1) RETURNING *',cols,cols) INTO result USING jsonb_build_object('status','draft')||p_data;
 ELSE
  EXECUTE format('UPDATE public.services t SET %s FROM jsonb_populate_record(NULL::public.services,$1) x WHERE t.id=$2 RETURNING t.*',assignments) INTO result USING p_data,p_id;
 END IF;
 INSERT INTO public.configuration_revisions(resource,record_id,record_version,actor_id,reason,before_data,after_data,request_id,request_data)
 VALUES('services',result.id,result.version,auth.uid(),btrim(reason),CASE WHEN p_id IS NOT NULL THEN to_jsonb(previous) END,to_jsonb(result),p_request_id,jsonb_build_object('data',p_data,'id',p_id,'version',p_expected_version));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_shop_service(jsonb,uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_shop_service(jsonb,uuid,integer,uuid) TO authenticated;
-- Existing clients retain the old signature and validation, using the same controlled writer.
CREATE OR REPLACE FUNCTION public.admin_save_service(p_data jsonb,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT NULL)
RETURNS public.services LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.admin_save_shop_service(p_data,p_id,p_expected_version,NULL);
$$;

CREATE FUNCTION wafou_private.shop_service_available(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.services s WHERE s.id=p_id AND s.status='published' AND s.shop_enabled
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.bundle_items) x LEFT JOIN public.services m ON m.id=(x->>'service_id')::uuid
   WHERE m.id IS NULL OR m.status IS DISTINCT FROM 'published' OR NOT m.shop_enabled OR m.offer_kind<>'individual'
    OR (x->>'quantity')::numeric<m.min_quantity OR (x->>'quantity')::numeric>coalesce(m.max_quantity,100000) OR mod((x->>'quantity')::numeric-m.min_quantity,m.quantity_step)<>0
    OR EXISTS(SELECT 1 FROM unnest(m.included_task_ids) task_id LEFT JOIN public.catalog_components c ON c.id=task_id WHERE c.id IS NULL OR c.status<>'active' OR c.service_id<>m.id OR c.kind<>'task'))
  AND NOT EXISTS(SELECT 1 FROM unnest(s.included_task_ids) task_id LEFT JOIN public.catalog_components c ON c.id=task_id
   WHERE c.id IS NULL OR c.status<>'active' OR c.service_id<>s.id OR c.kind<>'task'));
$$;
REVOKE ALL ON FUNCTION wafou_private.shop_service_available(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Deliberately narrow projection for future clients. No fee rules, audit, drafts or provider finance.
CREATE FUNCTION public.shop_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'version',s.version,'name_fr',s.name_fr,'name_en',s.name_en,
  'description_fr',s.description_fr,'description_en',s.description_en,'icon_key',s.icon_key,'offer_kind',s.offer_kind,
  'unit',s.unit,'min_quantity',s.min_quantity,'max_quantity',s.max_quantity,'quantity_step',s.quantity_step,'sort_order',s.sort_order,
  'included_fr',s.included_fr,'included_en',s.included_en,'excluded_fr',s.excluded_fr,'excluded_en',s.excluded_en,'bundle_items',s.bundle_items,
  'rates',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'currency',r.currency,'component_id',r.component_id,'pricing_mode',r.pricing_mode,'unit',r.unit,'amount_minor',r.amount_minor,'area_id',r.area_id,'cleaning_type_id',r.cleaning_type_id,'frequency_id',r.frequency_id,'valid_until',r.valid_until) ORDER BY r.id),'[]') FROM public.catalog_rates r WHERE r.service_id=s.id AND (r.component_id IS NULL OR EXISTS(SELECT 1 FROM public.catalog_components c WHERE c.id=r.component_id AND c.status='active' AND c.kind='option')) AND r.status='active' AND (r.valid_from IS NULL OR r.valid_from<=now()) AND (r.valid_until IS NULL OR r.valid_until>now())),
  'components',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'name_fr',c.name_fr,'name_en',c.name_en,'description_fr',c.description_fr,'description_en',c.description_en,'unit',c.unit,'min_quantity',c.min_quantity,'max_quantity',c.max_quantity,'quantity_step',c.quantity_step) ORDER BY c.sort_order,c.id),'[]') FROM public.catalog_components c WHERE c.service_id=s.id AND c.status='active' AND c.kind IN ('option','cleaning_type','frequency')))
  ORDER BY s.sort_order,s.id),'[]'::jsonb) FROM public.services s WHERE wafou_private.shop_service_available(s.id);
$$;
REVOKE ALL ON FUNCTION public.shop_catalog() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.shop_catalog() TO anon,authenticated;

CREATE FUNCTION public.admin_shop_preview(p_cart jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; option_entry jsonb; s public.services; c public.catalog_components; rate public.catalog_rates; fee public.platform_fee_rules;
 curr text; at_time timestamptz; area uuid; typ uuid; freq uuid; qty numeric; opt_qty numeric; hours numeric;
 selected uuid[]:='{}'; coverage uuid[]:='{}'; current_coverage uuid[]; options uuid[]; parents uuid[];
 issues jsonb:='[]'; lines jsonb:='[]'; fees jsonb:='[]'; snapshots jsonb:='[]'; option_snapshots jsonb; tasks jsonb;
 subtotal bigint:=0; group_subtotal bigint; line_amount bigint; fee_base bigint; fee_amount bigint; client_fee bigint:=0; provider_fee bigint:=0;
 groups jsonb:='[]'; group_entry jsonb; fee_ids uuid[]:='{}'; payer_name text; matches uuid[]; n integer;
BEGIN
 IF NOT wafou_private.has_permission('catalog.read') OR NOT wafou_private.has_permission('finance.read') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_cart IS NULL OR jsonb_typeof(p_cart)<>'object' OR octet_length(p_cart::text)>50000 OR jsonb_typeof(p_cart->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_cart->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CART'; END IF;
 curr:=p_cart->>'currency'; at_time:=coalesce((p_cart->>'at')::timestamptz,now()); area:=(p_cart->>'area_id')::uuid;
 IF curr IS NULL OR curr NOT IN ('CAD','USD','EUR') OR (area IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.service_areas WHERE id=area AND active)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CART'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_cart->'items') LOOP
  IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
  SELECT * INTO s FROM public.services WHERE id=(entry->>'service_id')::uuid;
  IF NOT FOUND OR s.id=ANY(selected) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE'; END IF;
  selected:=array_append(selected,s.id); qty:=(entry->>'quantity')::numeric;
  IF qty<=0 OR qty<s.min_quantity OR qty>coalesce(s.max_quantity,100000) OR scale(qty)>3 OR mod(qty-s.min_quantity,s.quantity_step)<>0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
  IF NOT wafou_private.shop_service_available(s.id) THEN issues:=issues||jsonb_build_array('SERVICE_UNAVAILABLE'); END IF;
  IF entry ? 'expected_version' AND (entry->>'expected_version')::integer IS DISTINCT FROM s.version THEN issues:=issues||jsonb_build_array('SERVICE_CHANGED'); END IF;
  current_coverage:=array_append(ARRAY(SELECT (x->>'service_id')::uuid FROM jsonb_array_elements(s.bundle_items) x),s.id);
  IF coverage && current_coverage THEN issues:=issues||jsonb_build_array('SERVICE_ALREADY_INCLUDED'); END IF;
  coverage:=coverage||current_coverage;
  typ:=nullif(entry->>'cleaning_type_id','')::uuid; freq:=nullif(entry->>'frequency_id','')::uuid;
  PERFORM wafou_private.billing_component(typ,s.id,'cleaning_type'); PERFORM wafou_private.billing_component(freq,s.id,'frequency');
  IF EXISTS(SELECT 1 FROM public.catalog_components WHERE id IN (typ,freq) AND status<>'active') THEN issues:=issues||jsonb_build_array('INACTIVE_COMPONENT'); END IF;
  SELECT count(*) INTO n FROM public.catalog_rates WHERE service_id=s.id AND component_id IS NULL AND status='active' AND currency=curr
   AND (cleaning_type_id IS NULL OR cleaning_type_id=typ) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
   AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
  group_subtotal:=0;
  IF n<>1 THEN issues:=issues||jsonb_build_array(CASE WHEN n=0 THEN 'RATE_UNCONFIGURED' ELSE 'AMBIGUOUS_RATE' END);
  ELSE
   SELECT * INTO rate FROM public.catalog_rates WHERE service_id=s.id AND component_id IS NULL AND status='active' AND currency=curr
    AND (cleaning_type_id IS NULL OR cleaning_type_id=typ) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF rate.pricing_mode='quote' THEN issues:=issues||jsonb_build_array('QUOTE_REQUIRED');
   ELSIF rate.pricing_mode='hourly' THEN
    IF jsonb_typeof(entry->'hours') IS DISTINCT FROM 'number' THEN issues:=issues||jsonb_build_array('HOURS_REQUIRED');
    ELSE hours:=(entry->>'hours')::numeric;
     IF hours<=0 OR hours>100000 OR scale(hours)>3 OR s.unit<>'hour' OR qty<>hours THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_HOURS'; END IF;
     group_subtotal:=round(rate.amount_minor*hours); END IF;
   ELSIF rate.pricing_mode='fixed' AND rate.unit=s.unit THEN group_subtotal:=round(rate.amount_minor*qty);
   ELSE issues:=issues||jsonb_build_array('INVALID_PRICING_UNIT'); END IF;
   lines:=lines||jsonb_build_array(jsonb_build_object('service_id',s.id,'rate',to_jsonb(rate),'quantity',qty,'amount_minor',group_subtotal));
  END IF;
  options:='{}'; option_snapshots:='[]'; parents:=array_remove(ARRAY[typ],NULL);
  IF entry ? 'options' AND jsonb_typeof(entry->'options')<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_OPTIONS'; END IF;
  IF jsonb_array_length(coalesce(entry->'options','[]'))>100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_OPTIONS'; END IF;
  FOR option_entry IN SELECT value FROM jsonb_array_elements(coalesce(entry->'options','[]')) LOOP
   SELECT * INTO c FROM public.catalog_components WHERE id=(option_entry->>'component_id')::uuid AND service_id=s.id AND kind='option';
   IF NOT FOUND OR c.id=ANY(options) OR jsonb_typeof(option_entry->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COMPONENT'; END IF;
   opt_qty:=(option_entry->>'quantity')::numeric;
   IF opt_qty<=0 OR opt_qty<c.min_quantity OR opt_qty>coalesce(c.max_quantity,100000) OR scale(opt_qty)>3 OR mod(opt_qty-c.min_quantity,c.quantity_step)<>0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
   IF c.status<>'active' THEN issues:=issues||jsonb_build_array('INACTIVE_COMPONENT'); END IF;
   options:=array_append(options,c.id); parents:=array_append(parents,c.id);
   option_snapshots:=option_snapshots||jsonb_build_array(jsonb_build_object('component',to_jsonb(c),'quantity',opt_qty));
   SELECT count(*) INTO n FROM public.catalog_rates WHERE service_id=s.id AND component_id=c.id AND status='active' AND currency=curr
    AND (cleaning_type_id IS NULL OR cleaning_type_id=typ) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF n<>1 THEN issues:=issues||jsonb_build_array(CASE WHEN n=0 THEN 'RATE_UNCONFIGURED' ELSE 'AMBIGUOUS_RATE' END); CONTINUE; END IF;
   SELECT * INTO rate FROM public.catalog_rates WHERE service_id=s.id AND component_id=c.id AND status='active' AND currency=curr
    AND (cleaning_type_id IS NULL OR cleaning_type_id=typ) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF rate.pricing_mode='quote' THEN issues:=issues||jsonb_build_array('QUOTE_REQUIRED'); CONTINUE; END IF;
   IF rate.unit IS DISTINCT FROM c.unit THEN issues:=issues||jsonb_build_array('INVALID_PRICING_UNIT'); CONTINUE; END IF;
   line_amount:=round(rate.amount_minor*opt_qty); group_subtotal:=group_subtotal+line_amount;
   lines:=lines||jsonb_build_array(jsonb_build_object('service_id',s.id,'rate',to_jsonb(rate),'quantity',opt_qty,'amount_minor',line_amount));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.catalog_links l WHERE l.status='active' AND l.service_id=s.id AND (l.cleaning_type_id IS NULL OR l.cleaning_type_id=typ)
    AND ((l.relation='incompatible' AND l.parent_id=ANY(parents) AND l.child_id=ANY(parents)) OR (l.relation='requires' AND l.parent_id=ANY(parents) AND NOT l.child_id=ANY(parents)))) THEN issues:=issues||jsonb_build_array('INCOMPATIBLE_SELECTION'); END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_links l WHERE l.status='active' AND l.relation='included' AND l.parent_id=ANY(options) AND l.child_id=ANY(s.included_task_ids) AND (l.cleaning_type_id IS NULL OR l.cleaning_type_id=typ)) OR
   EXISTS(SELECT 1 FROM public.catalog_links a JOIN public.catalog_links b ON a.child_id=b.child_id AND a.parent_id<>b.parent_id WHERE a.status='active' AND b.status='active' AND a.relation='included' AND b.relation='included' AND a.parent_id=ANY(options) AND b.parent_id=ANY(parents) AND (a.cleaning_type_id IS NULL OR a.cleaning_type_id=typ) AND (b.cleaning_type_id IS NULL OR b.cleaning_type_id=typ)) THEN issues:=issues||jsonb_build_array('TASK_ALREADY_INCLUDED'); END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_links a WHERE a.status='active' AND a.relation='excluded' AND a.parent_id=ANY(parents) AND (a.cleaning_type_id IS NULL OR a.cleaning_type_id=typ) AND
    (a.child_id=ANY(s.included_task_ids) OR EXISTS(SELECT 1 FROM public.catalog_links b WHERE b.status='active' AND b.relation='included' AND b.child_id=a.child_id AND b.parent_id=ANY(parents) AND (b.cleaning_type_id IS NULL OR b.cleaning_type_id=typ)))) THEN issues:=issues||jsonb_build_array('CONFLICTING_TASK_SCOPE'); END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') INTO tasks FROM public.catalog_links l WHERE l.status='active' AND l.parent_id=ANY(parents) AND (l.cleaning_type_id IS NULL OR l.cleaning_type_id=typ);
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('service',to_jsonb(s),'quantity',qty,'options',option_snapshots,'task_links',tasks,
   'included_tasks',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.catalog_components t WHERE t.id=ANY(s.included_task_ids)),
   'bundle_members',(SELECT coalesce(jsonb_agg(jsonb_build_object('service',to_jsonb(m),'quantity',x->'quantity')),'[]') FROM jsonb_array_elements(s.bundle_items) x JOIN public.services m ON m.id=(x->>'service_id')::uuid)));
  subtotal:=subtotal+group_subtotal;
  groups:=groups||jsonb_build_array(jsonb_build_object('service_id',s.id,'cleaning_type_id',typ,'frequency_id',freq,'subtotal',group_subtotal));
 END LOOP;
 -- Match a rule per service/payer, then apply each distinct rule once to its aggregated scope.
 FOREACH payer_name IN ARRAY ARRAY['client','provider'] LOOP
  FOR group_entry IN SELECT value FROM jsonb_array_elements(groups) LOOP
   SELECT array_agg(id) INTO matches FROM public.platform_fee_rules WHERE status='active' AND payer=payer_name AND currency=curr
    AND (service_id IS NULL OR service_id=(group_entry->>'service_id')::uuid) AND (cleaning_type_id IS NULL OR cleaning_type_id=(group_entry->>'cleaning_type_id')::uuid)
    AND (frequency_id IS NULL OR frequency_id=(group_entry->>'frequency_id')::uuid) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF coalesce(cardinality(matches),0)<>1 THEN issues:=issues||jsonb_build_array(CASE WHEN matches IS NULL THEN 'FEE_UNCONFIGURED_'||upper(payer_name) ELSE 'AMBIGUOUS_FEE' END);
   ELSIF NOT matches[1]=ANY(fee_ids) THEN fee_ids:=array_append(fee_ids,matches[1]); END IF;
  END LOOP;
 END LOOP;
 FOR fee IN SELECT * FROM public.platform_fee_rules WHERE id=ANY(fee_ids) LOOP
  SELECT coalesce(sum((g->>'subtotal')::bigint),0) INTO fee_base FROM jsonb_array_elements(groups) g
   WHERE (fee.service_id IS NULL OR fee.service_id=(g->>'service_id')::uuid) AND (fee.cleaning_type_id IS NULL OR fee.cleaning_type_id=(g->>'cleaning_type_id')::uuid)
    AND (fee.frequency_id IS NULL OR fee.frequency_id=(g->>'frequency_id')::uuid);
  fee_amount:=coalesce(fee.fixed_minor,0)+round(fee_base*coalesce(fee.percentage_bps,0)::numeric/10000);
  fee_amount:=least(greatest(fee_amount,coalesce(fee.minimum_minor,fee_amount)),coalesce(fee.maximum_minor,fee_amount));
  IF fee.payer='client' THEN client_fee:=client_fee+fee_amount; ELSE provider_fee:=provider_fee+fee_amount; END IF;
  fees:=fees||jsonb_build_array(jsonb_build_object('rule',to_jsonb(fee),'basis_minor',fee_base,'amount_minor',fee_amount));
 END LOOP;
 IF provider_fee>subtotal THEN issues:=issues||jsonb_build_array('PROVIDER_FEE_EXCEEDS_SUBTOTAL'); END IF;
 SELECT coalesce(jsonb_agg(DISTINCT value),'[]') INTO issues FROM jsonb_array_elements(issues);
 RETURN jsonb_build_object('simulation_only',true,'bookable',false,'taxes_status','unconfigured','currency',curr,'at',at_time,'issues',issues,
  'pricing_complete',jsonb_array_length(issues)=0,'subtotal_minor',CASE WHEN issues='[]'::jsonb THEN subtotal END,
  'client_total_before_tax_minor',CASE WHEN issues='[]'::jsonb THEN subtotal+client_fee END,
  'provider_net_before_tax_minor',CASE WHEN issues='[]'::jsonb THEN subtotal-provider_fee END,'items',snapshots,'lines',lines,'fees',fees);
END $$;
REVOKE ALL ON FUNCTION public.admin_shop_preview(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_shop_preview(jsonb) TO authenticated;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190009','Service shop metadata, controlled icons, flat bundles and multi-service admin simulation');
NOTIFY pgrst,'reload schema';
COMMIT;
