BEGIN;
-- Keep the existing RPC signature while adding controlled availability to the service editor.
CREATE OR REPLACE FUNCTION public.admin_save_service(p_data jsonb,p_id uuid DEFAULT NULL,p_expected_version integer DEFAULT NULL)
RETURNS public.services LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result public.services; previous public.services; field text; reason text; new_status text;
BEGIN
 IF NOT wafou_private.has_permission('catalog.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>50000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE'; END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF field NOT IN ('slug','name_fr','name_en','description_fr','description_en','status','change_reason') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PROTECTED_FIELD'; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['slug','name_fr','name_en','description_fr','description_en'] LOOP
  IF jsonb_typeof(p_data->field) IS DISTINCT FROM 'string' OR btrim(p_data->>field)='' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE_FIELD'; END IF;
 END LOOP;
 IF p_data->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SLUG'; END IF;
 reason:=p_data->>'change_reason';
 IF reason IS NULL OR length(btrim(reason)) NOT BETWEEN 3 AND 1000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANGE_REASON_REQUIRED'; END IF;
 IF p_data ? 'status' AND (p_data->>'status' IS NULL OR p_data->>'status' NOT IN ('draft','published','archived')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SERVICE_STATUS'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
 IF p_id IS NULL THEN
  INSERT INTO public.services(slug,name_fr,name_en,description_fr,description_en,status)
  VALUES(btrim(p_data->>'slug'),btrim(p_data->>'name_fr'),btrim(p_data->>'name_en'),
   btrim(p_data->>'description_fr'),btrim(p_data->>'description_en'),coalesce(p_data->>'status','draft')) RETURNING * INTO result;
 ELSE
  SELECT * INTO previous FROM public.services WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF p_expected_version IS NULL OR previous.version<>p_expected_version THEN
   RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
  new_status:=CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE previous.status END;
  UPDATE public.services SET slug=btrim(p_data->>'slug'),name_fr=btrim(p_data->>'name_fr'),name_en=btrim(p_data->>'name_en'),
   description_fr=btrim(p_data->>'description_fr'),description_en=btrim(p_data->>'description_en'),status=new_status
   WHERE id=p_id RETURNING * INTO result;
 END IF;
 INSERT INTO public.configuration_revisions(resource,record_id,record_version,actor_id,reason,before_data,after_data)
 VALUES('services',result.id,result.version,auth.uid(),btrim(reason),CASE WHEN p_id IS NOT NULL THEN to_jsonb(previous) END,to_jsonb(result));
 RETURN result;
END $$;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190007','Audited service availability editing; existing services are not republished');
NOTIFY pgrst,'reload schema';
COMMIT;
