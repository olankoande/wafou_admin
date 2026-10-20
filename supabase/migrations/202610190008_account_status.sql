BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('wafou.account.status',0));
INSERT INTO wafou_private.role_permissions(role,permission) VALUES('admin','accounts.manage') ON CONFLICT DO NOTHING;
CREATE TABLE wafou_private.account_status_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id), requested_status text NOT NULL,
 expected_version integer NOT NULL, reason text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON wafou_private.account_status_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_set_account_status(p_profile_id uuid,p_status text,p_expected_version integer,p_reason text,p_request_id uuid)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.profiles; previous_status text; event_id uuid;
 prior wafou_private.account_status_requests; correlation uuid:=gen_random_uuid();
BEGIN
 -- Serialise administrators suspending each other, then recheck the acting account.
 PERFORM pg_advisory_xact_lock(hashtextextended('wafou.account.status',0));
 IF NOT wafou_private.has_permission('accounts.manage') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('active','suspended') OR p_request_id IS NULL OR p_profile_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_ACCOUNT_ACTION'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 1000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANGE_REASON_REQUIRED'; END IF;
 SELECT * INTO prior FROM wafou_private.account_status_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF (prior.actor_id,prior.profile_id,prior.requested_status,prior.expected_version,prior.reason)
   IS DISTINCT FROM (auth.uid(),p_profile_id,p_status,p_expected_version,btrim(p_reason)) THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='IDEMPOTENCY_CONFLICT'; END IF;
  SELECT * INTO target FROM jsonb_populate_record(NULL::public.profiles,prior.response); RETURN target;
 END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF target.user_id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='SELF_ACCOUNT_CHANGE_DENIED'; END IF;
 IF p_expected_version IS NULL OR target.version<>p_expected_version THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='STATE_CONFLICT'; END IF;
 IF target.account_status IS NULL OR target.account_status NOT IN ('active','suspended') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ACCOUNT_STATE_NOT_MANAGEABLE'; END IF;
 IF target.account_status=p_status THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ACCOUNT_ALREADY_IN_STATE'; END IF;
 previous_status:=target.account_status;
 UPDATE public.profiles SET account_status=p_status WHERE id=p_profile_id RETURNING * INTO target;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,target_type,target_id,result,reason,correlation_id)
 VALUES(auth.uid(),'user',CASE WHEN p_status='active' THEN 'account.activate' ELSE 'account.deactivate' END,
  'profiles',target.id,'applied',btrim(p_reason),correlation);
 event_id:=wafou_private.record_event('account-status:'||target.id::text||':'||target.version::text,
  'EVT-018','profiles',target.id,target.version,
  jsonb_build_object('action',CASE WHEN p_status='active' THEN 'account_activated' ELSE 'account_suspended' END,
   'user_id',target.user_id,'previous_status',previous_status,'account_status',p_status),correlation);
 PERFORM wafou_private.enqueue_notification(event_id,target.user_id,'NTF-018',1,target.locale);
 INSERT INTO wafou_private.account_status_requests(request_id,actor_id,profile_id,requested_status,expected_version,reason,response)
 VALUES(p_request_id,auth.uid(),target.id,p_status,p_expected_version,btrim(p_reason),to_jsonb(target));
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid,text,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid,text,integer,text,uuid) TO authenticated;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190008','Audited and versioned WAFOU account activation/suspension');
NOTIFY pgrst,'reload schema';
COMMIT;
