# LEF official submission — implementation handoff

## What this patch does
- Replaces the TEST-only submission and disabled DocuSign demo on `application.html` with an official disclosure/typed-signature interface.
- Retrieves the authoritative, current disclosures using `get_required_disclosures()`.
- Records a separate acknowledgment of **each** approved disclosure using `acknowledge_disclosure()` and calls `submit_application()` only after required document and form checks.
- Locks submission if disclosures have not been approved/configured. Draft save and upload remain available.
- Uses existing `js/drafts.js`, `js/documents.js`, `js/application-draft.js`, and Supabase authentication. No database tables were added.

## Required backend work (Tanak)
1. Confirm `database/migrations/03_Database_Workflows.sql` has been applied (do not rerun blindly).
2. Confirm `database/migrations/07_Required_Documents_Texas_Phone.sql` has been reviewed/applied. This adds authoritative TX, 10-digit phone and document requirements on status transition to `submitted`.
3. Have LEF approve the exact application attestation, electronic-record consent, credit authorization, disclosure versions, and any relevant legal/e-signature requirements. Confirm whether any more advanced identity verification/e-sign service is required.
4. Review `database/templates/06_Approved_Submission_Rules_TEMPLATE.sql`, then populate **approved** text/versions and configure `lef_private.submission_rules()` **in a staging project**. Do not run the template unchanged. Include appropriate document types and required fields. Do not confuse these with automatic loan eligibility or authorization to pull credit.
5. Test `get_required_disclosures`, `acknowledge_disclosure`, and `submit_application` with a fictional verified borrower. Confirm all RLS and Storage permissions, that the submitted record is read-only, and that staff can access it. Test failures when docs/consent are missing, and retry/idempotency.

## Important limitations
- This is a typed-name e-signature/attestation, not DocuSign. Applicability and wording require LEF/legal approval; do not treat this as a universally sufficient legal signature.
- The browser checks improve UX. Server-side checks remain authoritative.
- Business submissions remain blocked if the existing backend requires `business_details.company_name` and the borrower form does not collect that information. Coordinate this requirement with LEF and Tanak before launch.
- The `submit_application` RPC does not automatically compute the private risk score. That is a separate production integration task.
- This patch does not send submission emails or implement account recovery.
- This is based on the most recent local project snapshot supplied in this conversation, not a guaranteed match for the current GitHub `main`. Review the pull-request diff before merging.

## Local validation
```
node --check js/official-submission.js
node --check js/application-draft.js
node --test js/official-submission.test.js
npm test
python3 -m http.server 8000
```
Do NOT use real borrower data in staging. Verify the complete workflow in staging before enabling public submissions.
