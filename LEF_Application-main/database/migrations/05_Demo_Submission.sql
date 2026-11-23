-- Run ONLY this file, as postgres. Does not enable official submission.
-- Before running, replace the zero UUID below with the intended APPLICANT test user's UID.
BEGIN;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
-- Applicants must not be able to write the demo marker directly.
REVOKE UPDATE(is_demo),INSERT(is_demo) ON public.applications FROM authenticated;
CREATE OR REPLACE FUNCTION lef_private.guard_demo_marker() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND
 ((TG_OP='INSERT' AND NEW.is_demo) OR
 (TG_OP='UPDATE' AND NEW.is_demo IS DISTINCT FROM OLD.is_demo)) THEN
 RAISE EXCEPTION 'Demo marker is server-managed' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lef_private.guard_demo_marker() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_demo_marker ON public.applications;
CREATE TRIGGER guard_demo_marker BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION lef_private.guard_demo_marker();
CREATE OR REPLACE FUNCTION lef_private.demo_submit_users() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ARRAY['ecd54ad4-45bb-4fa2-9b9a-b085d07e93be'::uuid];
$$;
REVOKE ALL ON FUNCTION lef_private.demo_submit_users() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.submit_demo_application(p_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; d record; k text; payload jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT(auth.uid()=ANY(lef_private.demo_submit_users())) THEN
 RAISE EXCEPTION 'Demo submission is restricted to configured test accounts' USING ERRCODE='42501'; END IF;
 SELECT x.*,p.auth_user_id INTO a FROM public.applications x JOIN public.applicants p ON p.id=x.applicant_id
 WHERE x.id=p_application_id FOR UPDATE OF x;
 IF NOT FOUND OR a.auth_user_id IS DISTINCT FROM auth.uid() THEN
 RAISE EXCEPTION 'Application unavailable' USING ERRCODE='42501'; END IF;
 IF a.status<>'draft' THEN
  IF a.is_demo THEN RETURN a.id; END IF;
  RAISE EXCEPTION 'Only test drafts may use demo submission';
 END IF;
 SELECT * INTO d FROM public.application_details WHERE application_id=a.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Save application details first'; END IF;
 payload=to_jsonb(d);
 FOREACH k IN ARRAY ARRAY['first_name','last_name','contact_email','contact_phone','address_line1','city','state_code','postal_code','monthly_income'] LOOP
 IF nullif(trim(payload->>k),'') IS NULL THEN RAISE EXCEPTION 'Complete field: %',k; END IF;
 END LOOP;
 IF d.monthly_income<0 THEN RAISE EXCEPTION 'Income must be nonnegative'; END IF;
 -- A demo signature is not stored as official consent and is not required here.
 UPDATE public.applications SET is_demo=true,status='submitted',submitted_at=now() WHERE id=a.id;
 RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.submit_demo_application(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_demo_application(uuid) TO authenticated;
COMMIT;
