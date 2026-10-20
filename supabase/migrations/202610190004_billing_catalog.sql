-- Additive admin configuration. No charge, tax rate or commercial tariff is enabled.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';

CREATE TABLE public.catalog_components (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 service_id uuid NOT NULL REFERENCES public.services(id), slug text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('cleaning_type','room','option','task','frequency')),
 name_fr text NOT NULL, name_en text NOT NULL, description_fr text NOT NULL DEFAULT '', description_en text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 unit text CHECK(unit IN ('item','hour','m2','window','load','bed','flight','module')),
 min_quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK(min_quantity>=0 AND min_quantity<=100000),
 max_quantity numeric(12,3) CHECK(max_quantity>=min_quantity AND max_quantity<=100000),
 quantity_step numeric(12,3) NOT NULL DEFAULT 1 CHECK(quantity_step>0 AND quantity_step<=100000),
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 100000),
 equipment_fr text NOT NULL DEFAULT '', equipment_en text NOT NULL DEFAULT '',
 UNIQUE(service_id,slug), CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 CHECK(length(name_fr) BETWEEN 1 AND 200 AND length(name_en) BETWEEN 1 AND 200),
 CHECK(status<>'active' OR (btrim(description_fr)<>'' AND btrim(description_en)<>'' AND
  (kind NOT IN ('room','option') OR unit IS NOT NULL)))
);
CREATE TABLE public.catalog_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 service_id uuid NOT NULL REFERENCES public.services(id),
 parent_id uuid NOT NULL REFERENCES public.catalog_components(id), child_id uuid NOT NULL REFERENCES public.catalog_components(id),
 cleaning_type_id uuid REFERENCES public.catalog_components(id),
 relation text NOT NULL CHECK(relation IN ('included','excluded','incompatible','requires')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 CHECK(parent_id<>child_id), UNIQUE NULLS NOT DISTINCT(parent_id,child_id,cleaning_type_id,relation)
);
CREATE TABLE public.catalog_rates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 service_id uuid NOT NULL REFERENCES public.services(id), component_id uuid REFERENCES public.catalog_components(id),
 cleaning_type_id uuid REFERENCES public.catalog_components(id), frequency_id uuid REFERENCES public.catalog_components(id),
 area_id uuid REFERENCES public.service_areas(id), name_fr text NOT NULL, name_en text NOT NULL,
 pricing_mode text NOT NULL CHECK(pricing_mode IN ('unit','fixed','hourly','quote')),
 unit text CHECK(unit IN ('item','hour','m2','window','load','bed','flight','module')),
 amount_minor bigint CHECK(amount_minor BETWEEN 0 AND 1000000000),
 currency text NOT NULL CHECK(currency IN ('CAD','USD','EUR')),
 estimated_minutes integer CHECK(estimated_minutes BETWEEN 1 AND 100000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 valid_from timestamptz, valid_until timestamptz,
 CHECK(valid_from IS NULL OR valid_until IS NULL OR valid_from<valid_until),
 CHECK(pricing_mode<>'quote' OR amount_minor IS NULL),
 CHECK(status<>'active' OR pricing_mode='quote' OR amount_minor IS NOT NULL),
 CHECK(pricing_mode<>'hourly' OR unit='hour'),
 CHECK(pricing_mode NOT IN ('unit','fixed') OR unit IS NOT NULL),
 CHECK(component_id IS NULL OR pricing_mode IN ('unit','quote')),
 CHECK(component_id IS NOT NULL OR pricing_mode IN ('fixed','hourly','quote'))
);
CREATE TABLE public.platform_fee_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 service_id uuid REFERENCES public.services(id), cleaning_type_id uuid REFERENCES public.catalog_components(id),
 frequency_id uuid REFERENCES public.catalog_components(id), area_id uuid REFERENCES public.service_areas(id),
 name_fr text NOT NULL, name_en text NOT NULL, description_fr text NOT NULL DEFAULT '', description_en text NOT NULL DEFAULT '',
 payer text CHECK(payer IN ('client','provider')), fee_mode text CHECK(fee_mode IN ('fixed','percentage','combined')),
 basis text CHECK(basis='service_subtotal_excluding_tax'),
 fixed_minor bigint CHECK(fixed_minor BETWEEN 0 AND 1000000000),
 percentage_bps integer CHECK(percentage_bps BETWEEN 0 AND 10000),
 minimum_minor bigint CHECK(minimum_minor BETWEEN 0 AND 1000000000),
 maximum_minor bigint CHECK(maximum_minor BETWEEN 0 AND 1000000000),
 currency text NOT NULL CHECK(currency IN ('CAD','USD','EUR')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 valid_from timestamptz, valid_until timestamptz,
 CHECK(valid_from IS NULL OR valid_until IS NULL OR valid_from<valid_until),
 CHECK(minimum_minor IS NULL OR maximum_minor IS NULL OR minimum_minor<=maximum_minor),
 CHECK(fee_mode IS DISTINCT FROM 'fixed' OR percentage_bps IS NULL),
 CHECK(fee_mode IS DISTINCT FROM 'percentage' OR fixed_minor IS NULL),
 CHECK(status<>'active' OR (payer IS NOT NULL AND fee_mode IS NOT NULL AND basis IS NOT NULL AND
  btrim(description_fr)<>'' AND btrim(description_en)<>'' AND
  (fee_mode='percentage' OR fixed_minor IS NOT NULL) AND
  (fee_mode='fixed' OR percentage_bps IS NOT NULL)))
);
CREATE TABLE public.configuration_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 resource text NOT NULL, record_id uuid NOT NULL, record_version integer NOT NULL,
 actor_id uuid REFERENCES auth.users(id), reason text NOT NULL, before_data jsonb, after_data jsonb NOT NULL,
 request_id uuid UNIQUE, request_data jsonb,
 UNIQUE(resource,record_id,record_version)
);
CREATE INDEX catalog_components_service ON public.catalog_components(service_id,kind,status);
CREATE INDEX catalog_links_parent ON public.catalog_links(parent_id);
CREATE INDEX catalog_links_child ON public.catalog_links(child_id);
CREATE INDEX catalog_rates_service ON public.catalog_rates(service_id,component_id,status);
CREATE INDEX fee_rules_service ON public.platform_fee_rules(service_id,status);
CREATE INDEX configuration_history_target ON public.configuration_revisions(resource,record_id,created_at DESC);

-- Dedicated fee manager: do not grant new financial power to existing catalog/read-only roles.
INSERT INTO wafou_private.role_permissions(role,permission) VALUES
 ('admin','fees.manage'),('fee_manager','fees.manage'),('fee_manager','finance.read'),('fee_manager','catalog.read') ON CONFLICT DO NOTHING;

DO $$ DECLARE tab text; perm text; BEGIN
 FOREACH tab IN ARRAY ARRAY['catalog_components','catalog_links','catalog_rates','platform_fee_rules','configuration_revisions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  perm:=CASE WHEN tab='platform_fee_rules' THEN 'finance.read' WHEN tab='configuration_revisions' THEN 'audit.read' ELSE 'catalog.read' END;
  EXECUTE format('CREATE POLICY admin_scoped_read ON public.%I FOR SELECT TO authenticated USING(wafou_private.has_permission(%L))',tab,perm);
  IF tab<>'configuration_revisions' THEN
   EXECUTE format('CREATE TRIGGER touch_before_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION wafou_private.touch_row()',tab);
  END IF;
 END LOOP;
END $$;
CREATE TRIGGER configuration_append_only BEFORE UPDATE OR DELETE ON public.configuration_revisions
 FOR EACH ROW EXECUTE FUNCTION wafou_private.reject_mutation();

CREATE FUNCTION wafou_private.billing_component(p_id uuid,p_service uuid,p_kind text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_components
  WHERE id=p_id AND service_id=p_service AND (p_kind IS NULL OR kind=p_kind)) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COMPONENT_REFERENCE';
 END IF;
END $$;

CREATE FUNCTION public.admin_save_billing(p_resource text,p_data jsonb,p_id uuid DEFAULT NULL,
 p_expected_version integer DEFAULT NULL,p_reason text DEFAULT NULL,p_request_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed text[]; cols text; assignments text; key text; old_row jsonb; result jsonb; payload jsonb;
 perm text; service uuid; state text; cnt integer; field text; ref uuid; prior public.configuration_revisions;
BEGIN
 IF p_resource NOT IN ('catalog_components','catalog_links','catalog_rates','platform_fee_rules') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_RESOURCE'; END IF;
 perm:=CASE WHEN p_resource='platform_fee_rules' THEN 'fees.manage' ELSE 'catalog.manage' END;
 IF NOT wafou_private.has_permission(perm) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 1000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANGE_REASON_REQUIRED'; END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>50000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CONFIGURATION'; END IF;
 allowed:=CASE p_resource
  WHEN 'catalog_components' THEN ARRAY['service_id','slug','kind','name_fr','name_en','description_fr','description_en','status','unit','min_quantity','max_quantity','quantity_step','sort_order','equipment_fr','equipment_en']
  WHEN 'catalog_links' THEN ARRAY['service_id','parent_id','child_id','cleaning_type_id','relation','status']
  WHEN 'catalog_rates' THEN ARRAY['service_id','component_id','cleaning_type_id','frequency_id','area_id','name_fr','name_en','pricing_mode','unit','amount_minor','currency','estimated_minutes','status','valid_from','valid_until']
  ELSE ARRAY['service_id','cleaning_type_id','frequency_id','area_id','name_fr','name_en','description_fr','description_en','payer','fee_mode','basis','fixed_minor','percentage_bps','minimum_minor','maximum_minor','currency','status','valid_from','valid_until'] END;
 FOR key IN SELECT jsonb_object_keys(p_data) LOOP
  IF NOT key=ANY(allowed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PROTECTED_FIELD'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
 IF p_request_id IS NOT NULL THEN
  SELECT * INTO prior FROM public.configuration_revisions WHERE request_id=p_request_id;
  IF FOUND THEN
   IF prior.actor_id IS DISTINCT FROM auth.uid() OR prior.resource<>p_resource OR prior.request_data IS DISTINCT FROM
    jsonb_build_object('data',p_data,'id',p_id,'version',p_expected_version,'reason',p_reason) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='IDEMPOTENCY_CONFLICT'; END IF;
   RETURN prior.after_data;
  END IF;
 END IF;
 IF p_id IS NOT NULL THEN
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',p_resource) INTO old_row USING p_id;
  IF old_row IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF p_expected_version IS NULL OR (old_row->>'version')::integer<>p_expected_version THEN
   RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 END IF;
 payload:=coalesce(old_row,'{}')||p_data;
 state:=coalesce(payload->>'status','draft'); service:=(payload->>'service_id')::uuid;
 IF old_row IS NOT NULL AND (old_row->>'service_id' IS DISTINCT FROM payload->>'service_id' OR
  (p_resource='catalog_components' AND old_row->>'kind' IS DISTINCT FROM payload->>'kind')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='IMMUTABLE_SCOPE'; END IF;
 FOREACH field IN ARRAY ARRAY['name_fr','name_en'] LOOP
  IF p_resource<>'catalog_links' AND (payload->>field IS NULL OR length(btrim(payload->>field)) NOT BETWEEN 1 AND 200) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='BILINGUAL_NAME_REQUIRED'; END IF;
 END LOOP;
 IF p_resource IN ('catalog_rates','platform_fee_rules','catalog_links') THEN
  FOREACH field IN ARRAY ARRAY['cleaning_type_id','frequency_id','component_id','parent_id','child_id'] LOOP
   ref:=(payload->>field)::uuid;
   IF ref IS NOT NULL AND service IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='SERVICE_REQUIRED'; END IF;
   PERFORM wafou_private.billing_component(ref,service,CASE field WHEN 'cleaning_type_id' THEN 'cleaning_type' WHEN 'frequency_id' THEN 'frequency' ELSE NULL END);
   IF state='active' AND ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_components WHERE id=ref AND status='active') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INACTIVE_COMPONENT'; END IF;
  END LOOP;
 END IF;
 IF p_resource='catalog_links' THEN
  IF state='active' AND EXISTS(SELECT 1 FROM public.catalog_links l WHERE l.status='active'
   AND (p_id IS NULL OR l.id<>p_id) AND l.parent_id=(payload->>'parent_id')::uuid AND l.child_id=(payload->>'child_id')::uuid
   AND (l.cleaning_type_id IS NULL OR payload->>'cleaning_type_id' IS NULL OR l.cleaning_type_id=(payload->>'cleaning_type_id')::uuid)
   AND l.relation IN ('included','excluded') AND payload->>'relation' IN ('included','excluded') AND l.relation<>payload->>'relation') THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='CONFLICTING_TASK_SCOPE'; END IF;
  IF payload->>'relation' IN ('included','excluded') AND NOT EXISTS(SELECT 1 FROM public.catalog_components WHERE id=(payload->>'child_id')::uuid AND kind='task') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='TASK_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.catalog_components WHERE id=(payload->>'parent_id')::uuid AND kind IN ('task','frequency')) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PARENT'; END IF;
  IF payload->>'relation' IN ('incompatible','requires') AND EXISTS(SELECT 1 FROM public.catalog_components
   WHERE id IN ((payload->>'parent_id')::uuid,(payload->>'child_id')::uuid) AND kind NOT IN ('room','option','cleaning_type')) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COMPATIBILITY'; END IF;
 END IF;
 IF p_resource='catalog_rates' AND (payload->>'component_id') IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.catalog_components WHERE id=(payload->>'component_id')::uuid AND kind IN ('room','option')) OR
   ((payload->>'pricing_mode')='unit' AND NOT EXISTS(SELECT 1 FROM public.catalog_components WHERE id=(payload->>'component_id')::uuid AND unit=payload->>'unit')) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICING_UNIT'; END IF;
 END IF;
 -- Preserve dependent active configurations: archive the rules/links first.
 IF p_resource='catalog_components' AND old_row IS NOT NULL AND (state<>'active' OR old_row->>'unit' IS DISTINCT FROM payload->>'unit') AND
  (EXISTS(SELECT 1 FROM public.catalog_links WHERE status='active' AND p_id IN (parent_id,child_id,cleaning_type_id)) OR
   EXISTS(SELECT 1 FROM public.catalog_rates WHERE status='active' AND p_id IN (component_id,cleaning_type_id,frequency_id)) OR
   EXISTS(SELECT 1 FROM public.platform_fee_rules WHERE status='active' AND p_id IN (cleaning_type_id,frequency_id))) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ACTIVE_DEPENDENCIES'; END IF;
 IF p_resource IN ('catalog_rates','platform_fee_rules') AND state='active' THEN
  EXECUTE format('SELECT count(*) FROM public.%I t WHERE t.status=''active'' AND ($1 IS NULL OR t.id<>$1)
   AND t.currency=$2->>''currency''
   AND (t.service_id IS NULL OR ($2->>''service_id'') IS NULL OR t.service_id=($2->>''service_id'')::uuid)
   AND (t.cleaning_type_id IS NULL OR ($2->>''cleaning_type_id'') IS NULL OR t.cleaning_type_id=($2->>''cleaning_type_id'')::uuid)
   AND (t.frequency_id IS NULL OR ($2->>''frequency_id'') IS NULL OR t.frequency_id=($2->>''frequency_id'')::uuid)
   AND (t.area_id IS NULL OR ($2->>''area_id'') IS NULL OR t.area_id=($2->>''area_id'')::uuid)
   AND tstzrange(t.valid_from,t.valid_until,''[)'') && tstzrange(($2->>''valid_from'')::timestamptz,($2->>''valid_until'')::timestamptz,''[)'')
   AND %s',p_resource,CASE WHEN p_resource='catalog_rates' THEN '(t.component_id IS NOT DISTINCT FROM ($2->>''component_id'')::uuid
    OR (t.component_id IS NULL AND EXISTS(SELECT 1 FROM public.catalog_components WHERE id=($2->>''component_id'')::uuid AND kind=''room''))
    OR (($2->>''component_id'') IS NULL AND EXISTS(SELECT 1 FROM public.catalog_components WHERE id=t.component_id AND kind=''room'')))' ELSE 't.payer=$2->>''payer''' END)
   INTO cnt USING p_id,payload;
  IF cnt>0 THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='AMBIGUOUS_RULE'; END IF;
 END IF;
 SELECT string_agg(format('%I',a),','),string_agg(format('%I=x.%I',a,a),',') INTO cols,assignments
 FROM unnest(allowed) a WHERE p_data ? a;
 IF cols IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='EMPTY_CONFIGURATION'; END IF;
 IF p_id IS NULL THEN
  EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) RETURNING to_jsonb(%I.*)',p_resource,cols,cols,p_resource,p_resource) INTO result USING p_data;
 ELSE
  EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) x WHERE t.id=$2 RETURNING to_jsonb(t.*)',p_resource,assignments,p_resource) INTO result USING p_data,p_id;
 END IF;
 INSERT INTO public.configuration_revisions(resource,record_id,record_version,actor_id,reason,before_data,after_data,request_id,request_data)
 VALUES(p_resource,(result->>'id')::uuid,(result->>'version')::integer,auth.uid(),btrim(p_reason),old_row,result,p_request_id,
 jsonb_build_object('data',p_data,'id',p_id,'version',p_expected_version,'reason',p_reason));
 INSERT INTO public.audit_logs(actor_id,actor_type,action,target_type,target_id,result,reason,correlation_id)
 VALUES(auth.uid(),'user',CASE WHEN p_id IS NULL THEN 'configuration.create' ELSE 'configuration.update' END,
 p_resource,(result->>'id')::uuid,'applied',btrim(p_reason),gen_random_uuid());
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION wafou_private.billing_component(uuid,uuid,text),public.admin_save_billing(text,jsonb,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_billing(text,jsonb,uuid,integer,text,uuid) TO authenticated;

INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190004','Configurable cleaning catalog, rates, fee rules and immutable revisions');
NOTIFY pgrst,'reload schema';
COMMIT;
