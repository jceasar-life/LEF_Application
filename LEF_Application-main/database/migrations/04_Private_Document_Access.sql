-- FIRST create a PRIVATE bucket named lef-documents using Storage > New bucket.
-- Recommended prototype limits: 10 MB; application/pdf,image/jpeg,image/png.
-- Do not INSERT/DELETE storage.objects using SQL. Use the Storage API for files.
-- Run as postgres AFTER 03. Adds policies/functions, NOT application tables.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='lef-documents' AND NOT public) THEN
  RAISE EXCEPTION 'Create PRIVATE bucket lef-documents using the Storage dashboard first'; END IF;
 -- Policies combine with OR. Unknown policies could bypass these restrictions.
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND policyname NOT IN ('lef_document_read','lef_document_upload')) THEN
  RAISE EXCEPTION 'Existing Storage policies found. Review them before installing LIFE policies; nothing changed.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION lef_private.path_application(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 -- Key: APPLICATION_UUID / RANDOM_UUID.pdf (or jpg/jpeg/png), no nested paths.
 IF p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$' THEN RETURN NULL; END IF;
 RETURN split_part(p_name,'/',1)::uuid;
END $$;
CREATE OR REPLACE FUNCTION lef_private.can_upload_document(p_name text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE app record; app_id uuid;
BEGIN
 app_id=lef_private.path_application(p_name);
 IF auth.uid() IS NULL OR app_id IS NULL THEN RETURN false; END IF;
 SELECT a.status,p.auth_user_id INTO app FROM public.applications a JOIN public.applicants p
 ON p.id=a.applicant_id WHERE a.id=app_id FOR UPDATE OF a;
 RETURN FOUND AND app.status='draft' AND app.auth_user_id=auth.uid();
END $$;
CREATE OR REPLACE FUNCTION lef_private.can_read_document(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lef_private.can_view_application(lef_private.path_application(p_name));
$$;
REVOKE ALL ON FUNCTION lef_private.path_application(text),lef_private.can_upload_document(text),
 lef_private.can_read_document(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lef_private.can_upload_document(text),lef_private.can_read_document(text) TO authenticated;
DROP POLICY IF EXISTS lef_document_read ON storage.objects;
DROP POLICY IF EXISTS lef_document_upload ON storage.objects;
CREATE POLICY lef_document_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='lef-documents' AND lef_private.can_read_document(name));
CREATE POLICY lef_document_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='lef-documents' AND lef_private.can_upload_document(name));
-- No overwrite/delete policies. Use unique file names and upsert:false.
-- RLS is already managed/enabled by Supabase on storage.objects; do not alter it here.

-- Disallow document references to another application's path or nonexistent files.
-- This applies to new metadata; original fictional references are left untouched.
CREATE OR REPLACE FUNCTION lef_private.guard_document_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app record;
BEGIN
 SELECT a.status,p.auth_user_id INTO app FROM public.applications a JOIN public.applicants p
 ON p.id=a.applicant_id WHERE a.id=NEW.application_id FOR UPDATE OF a;
 IF NOT FOUND OR app.status<>'draft' THEN RAISE EXCEPTION 'Application must be a draft'; END IF;
 IF auth.uid() IS NOT NULL AND app.auth_user_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'Only the applicant can add documents' USING ERRCODE='42501'; END IF;
 IF lef_private.path_application(NEW.storage_path) IS DISTINCT FROM NEW.application_id THEN
  RAISE EXCEPTION 'File path must start with this application UUID and end with a random UUID plus an allowed extension'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='lef-documents' AND name=NEW.storage_path) THEN
  RAISE EXCEPTION 'Upload the file through Storage first, then save its document reference'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lef_private.guard_document_metadata() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_document_metadata ON public.documents;
CREATE TRIGGER guard_document_metadata BEFORE INSERT OR UPDATE ON public.documents
 FOR EACH ROW EXECUTE FUNCTION lef_private.guard_document_metadata();
COMMIT;
SELECT '04 installed. Test REAL upload and download through the Storage API before declaring storage complete.' AS result;
