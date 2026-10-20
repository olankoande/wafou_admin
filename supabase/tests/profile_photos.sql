BEGIN;
CREATE FUNCTION pg_temp.photo_assert(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'PHOTO_TEST_FAILED: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.photo_reject(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RAISE NOTICE 'PASS: %',label; RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'PHOTO_TEST_FAILED: accepted %',label;
END $$;
INSERT INTO auth.users(id,email) VALUES('95000000-0000-4000-8000-000000000001','photo-client@example.invalid'),('95000000-0000-4000-8000-000000000002','photo-other@example.invalid'),('95000000-0000-4000-8000-000000000003','photo-admin@example.invalid');
INSERT INTO public.profiles(id,user_id,account_status,display_name) VALUES
 ('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000001','active','Photo client'),
 ('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000002','active','Photo other'),
 ('95000000-0000-4000-8000-000000000013','95000000-0000-4000-8000-000000000003','active','Photo admin');
INSERT INTO public.user_roles(user_id,role) VALUES('95000000-0000-4000-8000-000000000003','admin');
INSERT INTO public.provider_profiles(id,user_id) VALUES('95000000-0000-4000-8000-000000000021','95000000-0000-4000-8000-000000000002');
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
 ('wafou-profile-photos','95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000031.jpg','{"mimetype":"image/jpeg","size":1024}'),
 ('wafou-profile-photos','95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-000000000032.png','{"mimetype":"image/png","size":1024}'),
 ('wafou-profile-photos','95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000033.jpg','{"mimetype":"image/svg+xml","size":1024}');
SELECT pg_temp.photo_assert((SELECT NOT public AND file_size_limit=2097152 FROM storage.buckets WHERE id='wafou-profile-photos'),'profile photos are private and size bounded');
SELECT pg_temp.photo_assert(NOT has_function_privilege('anon','public.set_profile_photo(text,integer,uuid,text)','EXECUTE'),'anonymous photo assignment denied');
SELECT pg_temp.photo_assert(NOT has_column_privilege('authenticated','public.profiles','photo_path','UPDATE'),'photo path cannot be assigned directly');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.photo_assert((SELECT count(*)=2 FROM storage.objects WHERE bucket_id='wafou-profile-photos'),'client reads only own photo objects');
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo('95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-000000000032.png',1)$q$,'22023','client cannot reference another user photo');
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo('95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000033.jpg',1)$q$,'22023','active SVG content rejected');
SELECT pg_temp.photo_reject($q$SELECT public.admin_provider_kyc('95000000-0000-4000-8000-000000000021')$q$,'42501','client cannot inspect provider KYC');
SELECT pg_temp.photo_assert((public.set_profile_photo('95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000031.jpg',1)).version=2,'own photo assigned with version increment');
SELECT pg_temp.photo_assert((public.set_profile_photo('95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000031.jpg',1)).version=2,'photo retry does not duplicate writes');
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo(NULL,1)$q$,'40001','stale photo removal rejected');
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo(NULL,1,'95000000-0000-4000-8000-000000000012','Attack')$q$,'42501','client cannot edit another profile');
SELECT pg_temp.photo_assert((public.set_profile_photo(NULL,2)).photo_path IS NULL,'photo can be unlinked without deleting the account');
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000003',true);
SELECT pg_temp.photo_assert((SELECT count(*)=3 FROM storage.objects WHERE bucket_id='wafou-profile-photos'),'admin can inspect private profile photos');
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo('95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-000000000032.png',1,'95000000-0000-4000-8000-000000000012')$q$,'22023','admin photo change requires a reason');
SELECT pg_temp.photo_assert((public.set_profile_photo('95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-000000000032.png',1,'95000000-0000-4000-8000-000000000012','Synthetic photo')).version=2,'admin can assign provider photo with a reason');
SELECT pg_temp.photo_assert(public.admin_provider_kyc('95000000-0000-4000-8000-000000000021')->>'identity_documents_enabled'='false' AND public.admin_provider_kyc('95000000-0000-4000-8000-000000000021')->>'photo_is_identity_verification'='false','KYC overview does not request identity documents or approve identity');
RESET ROLE;
SELECT pg_temp.photo_assert((SELECT verification_status IS NULL FROM public.provider_profiles WHERE id='95000000-0000-4000-8000-000000000021'),'photo does not change provider verification');
UPDATE public.profiles SET account_status='suspended' WHERE user_id='95000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.photo_reject($q$SELECT public.set_profile_photo(NULL,3)$q$,'42501','inactive account cannot change profile photo');
RESET ROLE;
SELECT 'ALL PROFILE PHOTO ASSERTIONS PASSED; FIXTURES ROLLED BACK' AS result;
ROLLBACK;
