-- Run AFTER 03 and 04 as postgres. Fictional test records/configuration are ROLLED BACK.
-- Edit ONLY the two applicant emails below if yours differ. Staff IDs are found by role.
-- Execute the WHOLE file; never execute selected fragments. Do not change ROLLBACK to COMMIT.
BEGIN;
SET LOCAL search_path = pg_temp, public;
CREATE TEMP TABLE pg_temp.lef_test_context(key text PRIMARY KEY,id uuid);
INSERT INTO pg_temp.lef_test_context VALUES
 ('a',(SELECT id FROM auth.users WHERE email='applicant.a@gmail.com')),
 ('b',(SELECT id FROM auth.users WHERE email='applicant.b@gmail.com')),
 ('reviewer',(SELECT user_id FROM public.staff_roles WHERE role='reviewer' ORDER BY assigned_at,user_id LIMIT 1)),
 ('admin',(SELECT user_id FROM public.staff_roles WHERE role='admin' ORDER BY assigned_at,user_id LIMIT 1)),
 ('app_a',gen_random_uuid()),('app_b',gen_random_uuid()),('app_missing',gen_random_uuid());
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.lef_test_context WHERE id IS NULL) THEN RAISE EXCEPTION 'Missing test accounts: check applicant emails and staff roles'; END IF;
 IF (SELECT count(DISTINCT id) FROM pg_temp.lef_test_context WHERE key IN ('a','b','reviewer','admin'))<>4 THEN
  RAISE EXCEPTION 'Use four DIFFERENT test accounts'; END IF;
 IF EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id IN
  (SELECT id FROM pg_temp.lef_test_context WHERE key IN ('a','b'))) THEN RAISE EXCEPTION 'Test applicants must not have staff roles'; END IF;
 IF EXISTS(SELECT 1 FROM public.staff_roles WHERE role='admin' AND user_id=(SELECT id FROM pg_temp.lef_test_context WHERE key='reviewer')) THEN
  RAISE EXCEPTION 'Test reviewer must not also be an administrator'; END IF;
END $$;
CREATE TEMP TABLE pg_temp.lef_test_results(test text,passed boolean,detail text);
GRANT SELECT ON pg_temp.lef_test_context TO authenticated,anon;
GRANT SELECT,INSERT ON pg_temp.lef_test_results TO authenticated,anon;
CREATE FUNCTION pg_temp.test_id(p_key text) RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT id FROM pg_temp.lef_test_context WHERE key=p_key;
$$;
CREATE FUNCTION pg_temp.check_result(p_test text,p_condition boolean) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO pg_temp.lef_test_results VALUES(p_test,coalesce(p_condition,false),NULL);
END $$;
CREATE FUNCTION pg_temp.expect_denied(p_test text,p_sql text,p_message text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$ DECLARE code text; msg text; BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
  INSERT INTO pg_temp.lef_test_results VALUES(p_test,
   code IN ('42501','P0001','23514') AND (p_message IS NULL OR msg ILIKE '%'||p_message||'%'),code||': '||msg);
  RETURN;
 END;
 INSERT INTO pg_temp.lef_test_results VALUES(p_test,false,'Unexpected success');
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.test_id(text),pg_temp.check_result(text,boolean),
 pg_temp.expect_denied(text,text,text) TO authenticated,anon;
DO $$ BEGIN
 EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated,anon',pg_my_temp_schema()::regnamespace::text);
END $$;
-- Existing profiles are reused; all fixtures in this file roll back.
INSERT INTO public.applicants(auth_user_id,first_name,last_name,email)
 SELECT u.id,'Fictional',CASE WHEN c.key='a' THEN 'Applicant A' ELSE 'Applicant B' END,u.email
 FROM auth.users u JOIN pg_temp.lef_test_context c ON c.id=u.id WHERE c.key IN ('a','b')
 ON CONFLICT(auth_user_id) DO NOTHING;
-- Test-only configuration is always rolled back, including on configured projects.
CREATE OR REPLACE FUNCTION lef_private.submission_rules() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT '{"ready":false}'::jsonb;
$$;
-- Submission must refuse unconfigured requirements, before installing test-only config.
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims',json_build_object('sub',pg_temp.test_id('a'),'role','authenticated')::text,true);
INSERT INTO public.applications(id,applicant_id,submission_key,loan_type,requested_amount)
 SELECT pg_temp.test_id('app_a'),id,gen_random_uuid(),'Personal',1000 FROM public.applicants WHERE auth_user_id=auth.uid();

SELECT pg_temp.expect_denied('Submission fails closed until configured',
 'SELECT public.submit_application(pg_temp.test_id(''app_a''))','not configured');
-- Test-only disclosures are NOT client-approved. Transaction rollback restores config.
CREATE OR REPLACE FUNCTION lef_private.submission_rules() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT '{"ready":true,"required_fields":["first_name","last_name","contact_email","contact_phone","address_line1","city","state_code","postal_code","monthly_income"],"business_required_keys":["company_name"],"required_document_types":[],"disclosures":[{"type":"application_attestation","version":"TEST-ONLY-1","text":"FICTIONAL TEST DISCLOSURE. NOT FOR REAL APPLICATIONS."}]}'::jsonb;
$$;
SELECT set_config('request.jwt.claims',json_build_object('sub',pg_temp.test_id('b'),'role','authenticated')::text,true);
INSERT INTO public.applications(id,applicant_id,submission_key,loan_type,requested_amount)
 SELECT pg_temp.test_id('app_b'),id,gen_random_uuid(),'Personal',2000 FROM public.applicants WHERE auth_user_id=auth.uid();
SELECT set_config('request.jwt.claims',json_build_object('sub',pg_temp.test_id('a'),'role','authenticated')::text,true);
INSERT INTO public.applications(id,applicant_id,submission_key,loan_type,requested_amount)
 SELECT pg_temp.test_id('app_missing'),id,gen_random_uuid(),'Personal',500 FROM public.applicants WHERE auth_user_id=auth.uid();

RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',pg_temp.test_id('a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_result('Applicant A sees own fixture',EXISTS(SELECT 1 FROM public.applications WHERE id=pg_temp.test_id('app_a')));
SELECT pg_temp.check_result('Applicant A cannot see B fixture',NOT EXISTS(SELECT 1 FROM public.applications WHERE id=pg_temp.test_id('app_b')));
SELECT pg_temp.expect_denied('Applicant cannot promote self','SELECT public.set_staff_role(auth.uid(),''admin'',true)','Administrator');
SELECT pg_temp.expect_denied('Applicant cannot write roles directly','INSERT INTO public.staff_roles(user_id,role) VALUES(auth.uid(),''admin'')');
SELECT pg_temp.expect_denied('Applicant cannot change status directly','UPDATE public.applications SET status=''approved'' WHERE id=pg_temp.test_id(''app_a'')');
SELECT pg_temp.expect_denied('Applicant cannot call review status function','SELECT public.update_application_status(pg_temp.test_id(''app_a''),''under_review'',''Test'')','permission denied');
SELECT pg_temp.expect_denied('Missing details block submission','SELECT public.submit_application(pg_temp.test_id(''app_missing''))','details required');

INSERT INTO public.application_details(application_id,first_name,last_name,contact_email,contact_phone,address_line1,city,state_code,postal_code,monthly_income)
VALUES(pg_temp.test_id('app_a'),'Fictional','Applicant A','applicant.a@example.com','9365550100','100 Fictional Lane','Nacogdoches','TX','75962',2000);
SELECT pg_temp.expect_denied('Consent required before submission','SELECT public.submit_application(pg_temp.test_id(''app_a''))','not acknowledged');
SELECT pg_temp.expect_denied('Wrong disclosure version denied','SELECT public.acknowledge_disclosure(pg_temp.test_id(''app_a''),''application_attestation'',''wrong'',''Test A'')','not current');
SELECT pg_temp.expect_denied('Raw consent text cannot be inserted','INSERT INTO public.application_consents(application_id,consent_type,disclosure_version,disclosure_text,signer_name,acknowledged,acknowledged_by) VALUES(pg_temp.test_id(''app_a''),''fake'',''1'',''fake'',''Test'',true,auth.uid())');
SELECT public.acknowledge_disclosure(pg_temp.test_id('app_a'),'application_attestation','TEST-ONLY-1','Fictional A');
SELECT pg_temp.check_result('Consent uses trusted disclosure text',EXISTS(SELECT 1 FROM public.application_consents WHERE application_id=pg_temp.test_id('app_a') AND disclosure_text='FICTIONAL TEST DISCLOSURE. NOT FOR REAL APPLICATIONS.'));