-- Run AFTER the successful ten-table migration, as postgres in SQL Editor.
-- Run the entire file. Transactional; existing records are preserved.
-- No extra application tables. Safe to repeat this file.
-- Proposed MVP states; have the team confirm before using real applications.
BEGIN;
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public') <> 10
 OR to_regclass('public.staff_roles') IS NULL
 OR to_regprocedure('lef_private.can_review_application(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Expected the existing LIFE ten-table schema. No changes applied.';
 END IF;
END $$;

-- Trusted configuration lives in a private function to keep the ten-table cap.
-- File 06 configures approved requirements later; until then submission fails closed.
-- Repeat runs preserve your existing configuration.
DO $outer$
BEGIN
 IF to_regprocedure('lef_private.submission_rules()') IS NULL THEN
 EXECUTE $ddl$
 CREATE FUNCTION lef_private.submission_rules() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT '{"ready":false,"required_fields":["first_name","last_name","contact_email","contact_phone","address_line1","city","state_code","postal_code","monthly_income"],"business_required_keys":["company_name"],"required_document_types":[],"disclosures":[]}'::jsonb;
 $body$;
 $ddl$;
 END IF;
END $outer$;
REVOKE ALL ON FUNCTION lef_private.submission_rules() FROM PUBLIC,anon,authenticated;

-- Replace only the known starter CHECKs. Abort on unknown status constraints.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname,pg_get_constraintdef(oid) AS definition
 FROM pg_constraint WHERE conrelid='public.applications'::regclass AND contype='c'
 LOOP
  IF c.conname IN ('applications_status_check','consistent_submission_time') THEN
   EXECUTE format('ALTER TABLE public.applications DROP CONSTRAINT %I',c.conname);
  ELSIF c.definition ~ '\mstatus\M' THEN
   RAISE EXCEPTION 'Unexpected status constraint: %. Review before migrating.',c.conname;
  END IF;
 END LOOP;
END $$;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check
 CHECK(status IN ('draft','submitted','under_review','approved','declined'));
ALTER TABLE public.applications ADD CONSTRAINT consistent_submission_time CHECK(
 (status='draft' AND submitted_at IS NULL) OR
 (status<>'draft' AND submitted_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS applications_queue_idx
 ON public.applications(status,submitted_at DESC,id);

-- Immutable applicant-visible history; internal underwriting notes belong elsewhere.
CREATE OR REPLACE FUNCTION public.record_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE explanation text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated actor required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN explanation='Application draft created';
 ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
  explanation=CASE WHEN NEW.status='submitted' THEN 'Application submitted'
   ELSE nullif(current_setting('lef.status_reason',true),'') END;
 ELSE RETURN NEW;
 END IF;
 INSERT INTO public.application_status_history(application_id,old_status,new_status,changed_by,reason)
 VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
 NEW.status,auth.uid(),explanation);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_application_status() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS immutable_status_history ON public.application_status_history;
CREATE TRIGGER immutable_status_history BEFORE UPDATE OR DELETE ON public.application_status_history
 FOR EACH ROW EXECUTE FUNCTION lef_private.reject_history_mutation();

-- Admin-only role management. No self-promotion or removal of the last admin.
CREATE OR REPLACE FUNCTION public.set_staff_role(p_user_id uuid,p_role text,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7081830921::bigint);
 IF auth.uid() IS NULL OR NOT lef_private.is_admin() THEN
  RAISE EXCEPTION 'Administrator permission required' USING ERRCODE='42501'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('reviewer','admin') OR p_enabled IS NULL THEN
  RAISE EXCEPTION 'Valid role and enabled flag required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'User does not exist'; END IF;
 IF p_enabled THEN
  INSERT INTO public.staff_roles(user_id,role) VALUES(p_user_id,p_role) ON CONFLICT DO NOTHING;
 ELSE
  IF p_role='admin' AND EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id=p_user_id AND role='admin')
   AND (SELECT count(*) FROM public.staff_roles WHERE role='admin')<=1 THEN
   RAISE EXCEPTION 'Cannot remove the last administrator'; END IF;
  DELETE FROM public.staff_roles WHERE user_id=p_user_id AND role=p_role;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.assign_reviewer(p_application_id uuid,p_reviewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT lef_private.is_admin() THEN
  RAISE EXCEPTION 'Administrator permission required' USING ERRCODE='42501'; END IF;
 IF p_reviewer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff_roles
  WHERE user_id=p_reviewer_id AND role='reviewer') THEN RAISE EXCEPTION 'Reviewer role required'; END IF;
 PERFORM 1 FROM public.applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
 UPDATE public.applications SET assigned_reviewer_id=p_reviewer_id WHERE id=p_application_id;
END $$;
CREATE OR REPLACE FUNCTION public.update_application_status(
 p_application_id uuid,p_new_status text,p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior text;
BEGIN
 SELECT status INTO prior FROM public.applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT lef_private.can_review_application(p_application_id) THEN
  RAISE EXCEPTION 'Application unavailable or permission denied' USING ERRCODE='42501'; END IF;
 IF p_new_status IS NULL OR p_new_status NOT IN ('under_review','approved','declined') THEN
  RAISE EXCEPTION 'Invalid review status'; END IF;
 IF prior=p_new_status THEN RETURN p_application_id; END IF;
 IF NOT ((prior='submitted' AND p_new_status='under_review') OR
  (prior='under_review' AND p_new_status IN ('approved','declined'))) THEN
  RAISE EXCEPTION 'Invalid transition: % -> %',prior,p_new_status; END IF;
 IF length(trim(coalesce(p_reason,'')))=0 OR length(p_reason)>1000 THEN
  RAISE EXCEPTION 'Provide an applicant-visible reason of 1 to 1000 characters'; END IF;
 PERFORM set_config('lef.status_reason',trim(p_reason),true);
 UPDATE public.applications SET status=p_new_status WHERE id=p_application_id;
 PERFORM set_config('lef.status_reason','',true);
 RETURN p_application_id;
END $$;

-- Official disclosures are served from trusted configuration, never caller-supplied text.
CREATE OR REPLACE FUNCTION public.get_required_disclosures()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 cfg=lef_private.submission_rules();
 IF NOT coalesce((cfg->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Submission requirements not configured'; END IF;
 RETURN cfg->'disclosures';
END $$;
REVOKE INSERT ON public.application_consents FROM authenticated;
-- Column grants from migration 02 must ALSO be removed.
REVOKE INSERT(application_id,consent_type,disclosure_version,disclosure_text,
 signer_name,acknowledged,acknowledged_by) ON public.application_consents FROM authenticated;
CREATE OR REPLACE FUNCTION public.acknowledge_disclosure(
 p_application_id uuid,p_consent_type text,p_version text,p_signer_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app record; cfg jsonb; disclosure jsonb; result_id uuid;
BEGIN
 SELECT a.status,p.auth_user_id INTO app FROM public.applications a
 JOIN public.applicants p ON p.id=a.applicant_id WHERE a.id=p_application_id FOR UPDATE OF a;
 IF NOT FOUND OR auth.uid() IS NULL OR app.auth_user_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'Application unavailable or permission denied' USING ERRCODE='42501'; END IF;
 IF app.status<>'draft' THEN RAISE EXCEPTION 'Application must be a draft'; END IF;
 IF length(trim(coalesce(p_signer_name,'')))=0 OR length(p_signer_name)>200 THEN RAISE EXCEPTION 'Signer name required (max 200 characters)'; END IF;
 cfg=lef_private.submission_rules();
 IF NOT coalesce((cfg->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Submission requirements not configured'; END IF;
 SELECT value INTO disclosure FROM jsonb_array_elements(cfg->'disclosures')
 WHERE value->>'type'=p_consent_type AND value->>'version'=p_version;
 IF disclosure IS NULL THEN RAISE EXCEPTION 'Disclosure type or version is not current'; END IF;
 INSERT INTO public.application_consents(application_id,consent_type,disclosure_version,
 disclosure_text,signer_name,acknowledged,acknowledged_by)
 VALUES(p_application_id,p_consent_type,p_version,disclosure->>'text',trim(p_signer_name),true,auth.uid())
 ON CONFLICT(application_id,consent_type,disclosure_version) DO NOTHING
 RETURNING id INTO result_id;
 IF result_id IS NULL THEN SELECT id INTO result_id FROM public.application_consents
  WHERE application_id=p_application_id AND consent_type=p_consent_type AND disclosure_version=p_version; END IF;
 RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_application(p_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app record; detail jsonb; cfg jsonb; key text; d jsonb;
BEGIN
 SELECT a.status,a.loan_type,p.auth_user_id INTO app FROM public.applications a
 JOIN public.applicants p ON p.id=a.applicant_id WHERE a.id=p_application_id FOR UPDATE OF a;
 IF NOT FOUND OR auth.uid() IS NULL OR app.auth_user_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'Application unavailable or permission denied' USING ERRCODE='42501'; END IF;
 -- Retry after submission/processing returns the same ID; no duplicate history.
 IF app.status<>'draft' THEN RETURN p_application_id; END IF;
 cfg=lef_private.submission_rules();
 IF NOT coalesce((cfg->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Submission requirements not configured'; END IF;
 SELECT to_jsonb(x) INTO detail FROM public.application_details x WHERE x.application_id=p_application_id;
 IF detail IS NULL THEN RAISE EXCEPTION 'Application details required'; END IF;
 FOR key IN SELECT jsonb_array_elements_text(cfg->'required_fields') LOOP
  IF nullif(trim(detail->>key),'') IS NULL THEN RAISE EXCEPTION 'Required field missing: %',key; END IF;
 END LOOP;
 IF detail->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid contact email required'; END IF;
 IF (detail->>'date_of_birth')::date > current_date THEN RAISE EXCEPTION 'Date of birth cannot be in the future'; END IF;
 IF app.loan_type='Business' THEN
  FOR key IN SELECT jsonb_array_elements_text(cfg->'business_required_keys') LOOP
   IF nullif(trim(detail->'business_details'->>key),'') IS NULL THEN RAISE EXCEPTION 'Required business field missing: %',key; END IF;
  END LOOP;
 END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(cfg->'disclosures') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.application_consents c WHERE c.application_id=p_application_id
   AND c.consent_type=d->>'type' AND c.disclosure_version=d->>'version'
   AND c.disclosure_text=d->>'text' AND c.acknowledged AND c.acknowledged_by=auth.uid()) THEN
   RAISE EXCEPTION 'Required disclosure not acknowledged: %',d->>'type'; END IF;
 END LOOP;
 FOR key IN SELECT jsonb_array_elements_text(cfg->'required_document_types') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.documents doc JOIN storage.objects o
   ON o.bucket_id='lef-documents' AND o.name=doc.storage_path
   WHERE doc.application_id=p_application_id AND doc.document_type=key) THEN
   RAISE EXCEPTION 'Required uploaded document missing: %',key; END IF;
 END LOOP;
 UPDATE public.applications SET status='submitted',submitted_at=now() WHERE id=p_application_id;
 RETURN p_application_id;
END $$;

-- Staff-only queue. SECURITY INVOKER preserves existing RLS. No raw SQL from callers.
CREATE OR REPLACE FUNCTION public.list_application_queue(
 p_status text DEFAULT NULL,p_search text DEFAULT NULL,
 p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL,
 p_limit integer DEFAULT 25,p_offset integer DEFAULT 0)
RETURNS TABLE(application_id uuid,applicant_name text,loan_type text,
 requested_amount numeric,status text,submitted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_roles WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Staff permission required' USING ERRCODE='42501'; END IF;
 IF p_status IS NOT NULL AND p_status NOT IN ('submitted','under_review','approved','declined') THEN RAISE EXCEPTION 'Invalid queue status'; END IF;
 RETURN QUERY SELECT a.id,p.first_name||' '||p.last_name,a.loan_type,a.requested_amount,a.status,a.submitted_at
 FROM public.applications a JOIN public.applicants p ON p.id=a.applicant_id
 WHERE a.status<>'draft' AND lef_private.can_review_application(a.id)
 AND (p_status IS NULL OR a.status=p_status)
 AND (nullif(trim(p_search),'') IS NULL OR (p.first_name||' '||p.last_name) ILIKE '%'||p_search||'%'
  OR a.id::text ILIKE '%'||p_search||'%')
 AND (p_from IS NULL OR a.submitted_at>=p_from) AND (p_to IS NULL OR a.submitted_at<p_to)
 ORDER BY a.submitted_at DESC,a.id
 LIMIT greatest(1,least(coalesce(p_limit,25),100)) OFFSET greatest(coalesce(p_offset,0),0);
END $$;

-- Keep score creation privileged. Existing scoring evidence may be added once review starts.
CREATE OR REPLACE FUNCTION lef_private.guard_evaluation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app_type text; matrix_type text; app_status text;
BEGIN
 SELECT loan_type,status INTO app_type,app_status FROM public.applications WHERE id=NEW.application_id FOR UPDATE;
 IF app_status NOT IN ('submitted','under_review') OR app_status IS NULL THEN RAISE EXCEPTION 'Scoring requires an active submitted application'; END IF;
 SELECT loan_type INTO matrix_type FROM public.rating_matrices WHERE id=NEW.matrix_id;
 IF app_type IS DISTINCT FROM matrix_type THEN RAISE EXCEPTION 'Matrix loan type must match application'; END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.set_staff_role(uuid,text,boolean),
 public.assign_reviewer(uuid,uuid),public.update_application_status(uuid,text,text),
 public.get_required_disclosures(),public.acknowledge_disclosure(uuid,text,text,text),
 public.submit_application(uuid),public.list_application_queue(text,text,timestamptz,timestamptz,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_role(uuid,text,boolean),
 public.assign_reviewer(uuid,uuid),public.update_application_status(uuid,text,text),
 public.get_required_disclosures(),public.acknowledge_disclosure(uuid,text,text,text),
 public.submit_application(uuid),public.list_application_queue(text,text,timestamptz,timestamptz,integer,integer)
 TO authenticated;
REVOKE ALL ON FUNCTION lef_private.guard_evaluation() FROM PUBLIC,anon,authenticated;
COMMIT;
SELECT '03 installed; exactly 10 application tables remain; submission awaits approved configuration' AS result;
