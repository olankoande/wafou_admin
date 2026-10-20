-- Optional client/provider profile pictures. No identity documents, face matching or KYC approval.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(hashtextextended('wafou.profile.photos',0));
ALTER TABLE public.profiles ADD COLUMN photo_path text;
ALTER TABLE public.profiles ADD CONSTRAINT profile_photo_owner_path CHECK(photo_path IS NULL OR
 (photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' AND split_part(photo_path,'/',1)=user_id::text));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('wafou-profile-photos','wafou-profile-photos',false,2097152,ARRAY['image/jpeg','image/png','image/webp']);

CREATE FUNCTION wafou_private.profile_photo_access(p_name text,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT wafou_private.is_active() AND p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' AND EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.user_id::text=split_part(p_name,'/',1) AND
   (p.user_id=auth.uid() OR wafou_private.has_permission(CASE WHEN p_write THEN 'accounts.manage' ELSE 'accounts.read' END)
    OR (NOT p_write AND wafou_private.has_permission('providers.read') AND EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.user_id=p.user_id))));
$$;
REVOKE ALL ON FUNCTION wafou_private.profile_photo_access(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION wafou_private.profile_photo_access(text,boolean) TO authenticated;
CREATE POLICY profile_photo_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='wafou-profile-photos' AND wafou_private.profile_photo_access(name,false));
CREATE POLICY profile_photo_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='wafou-profile-photos' AND wafou_private.profile_photo_access(name,true));
-- Keep other permissive policies from widening this bucket, while preserving unrelated buckets.
CREATE POLICY profile_photo_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'wafou-profile-photos' OR wafou_private.profile_photo_access(name,false));
CREATE POLICY profile_photo_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'wafou-profile-photos' OR wafou_private.profile_photo_access(name,true));
CREATE POLICY profile_photo_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'wafou-profile-photos') WITH CHECK(bucket_id<>'wafou-profile-photos');
CREATE POLICY profile_photo_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id<>'wafou-profile-photos');
CREATE POLICY profile_photo_no_anon ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
 USING(bucket_id<>'wafou-profile-photos');

CREATE FUNCTION public.set_profile_photo(p_path text,p_expected_version integer,p_profile_id uuid DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.profiles; object_metadata jsonb; result public.profiles;
BEGIN
 IF NOT wafou_private.is_active() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO target FROM public.profiles WHERE (p_profile_id IS NULL AND user_id=auth.uid()) OR id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF NOT wafou_private.is_active() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF target.user_id<>auth.uid() AND NOT wafou_private.has_permission('accounts.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF target.user_id<>auth.uid() AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 1000) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANGE_REASON_REQUIRED'; END IF;
 IF p_expected_version IS NULL OR p_expected_version<1 THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 -- A repeated assignment/removal is harmless, including after a lost response.
 IF target.photo_path IS NOT DISTINCT FROM p_path THEN RETURN target; END IF;
 IF target.version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 IF p_path IS NOT NULL THEN
  IF NOT wafou_private.profile_photo_access(p_path,true) OR split_part(p_path,'/',1)<>target.user_id::text THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PROFILE_PHOTO'; END IF;
  SELECT metadata INTO object_metadata FROM storage.objects WHERE bucket_id='wafou-profile-photos' AND name=p_path FOR SHARE;
  IF NOT FOUND OR coalesce(object_metadata->>'mimetype','') NOT IN ('image/jpeg','image/png','image/webp') OR jsonb_typeof(object_metadata->'size') IS DISTINCT FROM 'number'
    OR (object_metadata->>'size')::numeric NOT BETWEEN 1 AND 2097152 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PROFILE_PHOTO'; END IF;
 END IF;
 UPDATE public.profiles SET photo_path=p_path WHERE id=target.id RETURNING * INTO result;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,target_type,target_id,result,reason,correlation_id)
 VALUES(auth.uid(),'user',CASE WHEN p_path IS NULL THEN 'profile.photo.remove' ELSE 'profile.photo.set' END,'profiles',target.id,'applied',coalesce(nullif(btrim(p_reason),''),'Update own profile photo'),gen_random_uuid());
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_profile_photo(text,integer,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_profile_photo(text,integer,uuid,text) TO authenticated;

CREATE FUNCTION public.admin_provider_kyc(p_provider_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE provider public.provider_profiles; profile public.profiles;
BEGIN
 IF NOT wafou_private.has_permission('providers.read') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO provider FROM public.provider_profiles WHERE id=p_provider_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT * INTO profile FROM public.profiles WHERE user_id=provider.user_id;
 RETURN jsonb_build_object('profile_id',profile.id,'user_id',provider.user_id,'display_name',profile.display_name,'phone',profile.phone,
  'locale',profile.locale,'account_status',profile.account_status,'photo_path',profile.photo_path,'profile_version',profile.version,
  'verification_status',provider.verification_status,'photo_is_identity_verification',false,'identity_documents_enabled',false);
END $$;
REVOKE ALL ON FUNCTION public.admin_provider_kyc(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_provider_kyc(uuid) TO authenticated;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610200011','Private optional profile photos for clients/providers; provider KYC overview without identity documents');
NOTIFY pgrst,'reload schema';
COMMIT;
