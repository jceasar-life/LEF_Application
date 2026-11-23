-- DO NOT run unchanged. Replace disclosure placeholders with CLIENT-APPROVED text.
-- Team must confirm required fields, document types, and Business keys as well.
-- This config adds NO table. Run AFTER 03, as postgres in SQL Editor.
-- Changes affect new submissions; stored consent text remains immutable evidence.
-- Do not edit disclosure wording without changing its version.
BEGIN;
DO $configure$
DECLARE
 cfg jsonb := $json$
 {
  "ready": true,
  "required_fields": [
   "first_name", "last_name", "contact_email", "contact_phone",
   "address_line1", "city", "state_code", "postal_code", "monthly_income"
  ],
  "business_required_keys": ["company_name"],
  "required_document_types": [],
  "disclosures": [
   {
    "type": "application_attestation",
    "version": "REPLACE_WITH_APPROVED_VERSION",
    "text": "REPLACE_WITH_CLIENT_APPROVED_ATTESTATION_TEXT"
   },
   {
    "type": "credit_authorization",
    "version": "REPLACE_WITH_APPROVED_VERSION",
    "text": "REPLACE_WITH_CLIENT_APPROVED_CREDIT_AUTHORIZATION_TEXT"
   }
  ]
 }
 $json$::jsonb;
 d jsonb; key text;
BEGIN
 IF cfg::text LIKE '%REPLACE_WITH_%' THEN RAISE EXCEPTION 'Replace placeholders with approved disclosure text/version before running. No configuration changed.'; END IF;
 IF jsonb_array_length(cfg->'disclosures')=0 THEN RAISE EXCEPTION 'At least one approved disclosure is required'; END IF;
 FOR key IN SELECT jsonb_array_elements_text(cfg->'required_fields') LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='application_details' AND column_name=key) THEN RAISE EXCEPTION 'Unknown required field: %',key; END IF;
 END LOOP;
 FOR d IN SELECT value FROM jsonb_array_elements(cfg->'disclosures') LOOP
  IF nullif(trim(d->>'type'),'') IS NULL OR nullif(trim(d->>'version'),'') IS NULL
  OR nullif(trim(d->>'text'),'') IS NULL THEN RAISE EXCEPTION 'Each disclosure requires type, version and approved text'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(cfg->'disclosures') GROUP BY value->>'type' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Use one current disclosure per type'; END IF;
 EXECUTE format('CREATE OR REPLACE FUNCTION lef_private.submission_rules() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='''' AS %L',
  'SELECT '||quote_literal(cfg::text)||'::jsonb;');
END $configure$;
REVOKE ALL ON FUNCTION lef_private.submission_rules() FROM PUBLIC,anon,authenticated;
COMMIT;
SELECT 'Approved submission rules configured' AS result;
