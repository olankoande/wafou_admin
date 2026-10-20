-- Provider-owned dated availability; no recurrence or booking/assignment transitions.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(hashtextextended('wafou.provider.availability',0));
GRANT SELECT ON public.availability_slots TO authenticated;
CREATE POLICY availability_self_read ON public.availability_slots FOR SELECT TO authenticated
 USING(wafou_private.owns_provider(provider_id));
CREATE POLICY availability_admin_read ON public.availability_slots FOR SELECT TO authenticated
 USING(wafou_private.has_permission('providers.read'));

CREATE FUNCTION public.provider_availability(p_provider_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE provider public.provider_profiles;
BEGIN
 IF NOT wafou_private.is_active() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO provider FROM public.provider_profiles WHERE
  (p_provider_id IS NULL AND user_id=auth.uid()) OR id=p_provider_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF provider.user_id<>auth.uid() AND NOT wafou_private.has_permission('providers.read') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 RETURN jsonb_build_object('provider_id',provider.id,'agenda_version',provider.agenda_version,'slots',
  coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'timezone',s.timezone)
   ORDER BY s.starts_at,s.id) FROM public.availability_slots s WHERE s.provider_id=provider.id),'[]'::jsonb));
END $$;

-- One atomic edit, with the provider inferred from the current authenticated user.
-- NULL id creates; removal requires an id. A retry of an identical edit is harmless.
CREATE FUNCTION public.save_my_availability(p_expected_agenda_version integer,p_slot_id uuid DEFAULT NULL,
 p_starts_at text DEFAULT NULL,p_ends_at text DEFAULT NULL,p_timezone text DEFAULT NULL,p_remove boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE provider public.provider_profiles; slot public.availability_slots; start_time timestamptz; end_time timestamptz;
BEGIN
 IF NOT wafou_private.is_active() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO provider FROM public.provider_profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PROVIDER_REQUIRED'; END IF;
 IF NOT wafou_private.is_active() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_expected_agenda_version IS NULL OR p_expected_agenda_version<1 OR p_remove IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AVAILABILITY'; END IF;
 IF p_slot_id IS NOT NULL THEN
  SELECT * INTO slot FROM public.availability_slots WHERE id=p_slot_id;
  IF FOUND AND slot.provider_id<>provider.id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 END IF;
 IF p_remove THEN
  IF p_slot_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AVAILABILITY'; END IF;
  IF slot.id IS NULL THEN RETURN public.provider_availability(); END IF;
 ELSE
  -- An explicit offset is required: an ambiguous local hour cannot be guessed by PostgreSQL.
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_timezone IS NULL OR
   p_starts_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' OR
   p_ends_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' OR
   NOT wafou_private.valid_timezone(p_timezone) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AVAILABILITY'; END IF;
  BEGIN start_time:=p_starts_at::timestamptz; end_time:=p_ends_at::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AVAILABILITY'; END;
  IF NOT isfinite(start_time) OR NOT isfinite(end_time) OR start_time>=end_time THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AVAILABILITY'; END IF;
  IF p_slot_id IS NOT NULL AND slot.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF slot.id IS NOT NULL AND slot.starts_at=start_time AND slot.ends_at=end_time AND slot.timezone=p_timezone THEN
   RETURN public.provider_availability(); END IF;
  IF p_slot_id IS NULL AND EXISTS(SELECT 1 FROM public.availability_slots WHERE provider_id=provider.id
   AND starts_at=start_time AND ends_at=end_time AND timezone=p_timezone) THEN RETURN public.provider_availability(); END IF;
 END IF;
 IF provider.agenda_version<>p_expected_agenda_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 IF NOT p_remove AND EXISTS(SELECT 1 FROM public.availability_slots s WHERE s.provider_id=provider.id
  AND (p_slot_id IS NULL OR s.id<>p_slot_id) AND s.starts_at<end_time AND s.ends_at>start_time) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='AVAILABILITY_OVERLAP'; END IF;
 IF p_remove THEN DELETE FROM public.availability_slots WHERE id=slot.id;
 ELSIF slot.id IS NULL THEN
  INSERT INTO public.availability_slots(provider_id,starts_at,ends_at,timezone) VALUES(provider.id,start_time,end_time,p_timezone) RETURNING * INTO slot;
 ELSE UPDATE public.availability_slots SET starts_at=start_time,ends_at=end_time,timezone=p_timezone WHERE id=slot.id; END IF;
 UPDATE public.provider_profiles SET agenda_version=agenda_version+1 WHERE id=provider.id;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,target_type,target_id,result,correlation_id)
 VALUES(auth.uid(),'user',CASE WHEN p_remove THEN 'availability.remove' ELSE 'availability.save' END,'availability_slots',slot.id,'applied',gen_random_uuid());
 RETURN public.provider_availability();
END $$;
REVOKE ALL ON FUNCTION public.provider_availability(uuid),public.save_my_availability(integer,uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.provider_availability(uuid),public.save_my_availability(integer,uuid,text,text,text,boolean) TO authenticated;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610200012','Provider-owned dated availability with agenda versioning and scoped admin reads');
NOTIFY pgrst,'reload schema';
COMMIT;
