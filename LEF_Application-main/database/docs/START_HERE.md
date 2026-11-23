# LIFE database finishing package

This package extends your EXISTING ten-table Supabase database. No new application tables are added. Your accounts, roles and test applications are preserved. Do not rerun the original four-table or ten-table scripts.

## What you do now — no PowerShell needed

1. Download/extract this ZIP. Open `03_Database_Workflows.sql` in Notepad or VS Code. Copy the entire file into **Supabase > SQL Editor > New query**. Run it as the default `postgres` role. Do not select individual statements. Expected result: `03 installed...`.
2. In **Storage**, create a bucket named exactly **lef-documents**, with **Public OFF**. For the prototype set a 10 MB per-file limit and allow PDF/JPEG/PNG (`application/pdf`, `image/jpeg`, `image/png`). Confirm these limits with the team. Create/manage buckets and real files through the dashboard or Storage API, never by inserting/deleting Storage metadata in SQL.
3. Run all of `04_Private_Document_Access.sql` in another new SQL query. Expected result: `04 installed...`. It stops safely if it finds unknown existing Storage policies, because permissive policies could bypass these rules. If it stops, send the error; don't delete existing policies blindly.
4. Open `05_Rollback_Tests.sql`. Check the two applicant emails at the top. Change `applicant.b@gmail.com` to `applicant.b@gmaill.com` if that is the actual account email. The script finds the oldest reviewer/admin by assigned_at then user UUID; it requires four distinct accounts and the reviewer must not also be an admin. Run the WHOLE file. Expect **45 rows with passed=true** in the test results. The final ROLLBACK removes all test fixtures and restores the previous submission configuration. Never change ROLLBACK to COMMIT. Save the results as evidence. An error instead of results means the suite did not complete; run `ROLLBACK;` before correcting/retrying.
5. Get the approved disclosure wording and versions, required fields/document types, and review workflow from your team/client. Edit **06_Approved_Submission_Rules_TEMPLATE.sql**, then run it. The unchanged template deliberately refuses to run. Required fields in the template are a proposed baseline, NOT a claim that all client form requirements are covered. Required document types are currently an empty list: populate them if documents are mandatory. They must exactly match frontend `document_type` values. Business-specific document requirements are not modeled separately by this baseline.
6. Pass `FRONTEND_HANDOFF.md` and the SQL migrations to your teammates. Repeat the important tests with actual sign-ins and file uploads/downloads during integration.

If a script errors, do not delete tables. Copy the complete error and run `ROLLBACK;` in that session before retrying. Run first against fictional data/development; the new submit function will stop incomplete drafts from submitting. Existing submitted applications remain unchanged.

## What this implements

- Proposed workflow: draft -> submitted -> under_review -> approved OR declined. Terminal decisions cannot reopen. No automatic decision or invented scoring formula.
- Protected, idempotent status RPC, with row locking, acting user and applicant-visible reason in immutable history. Repeated identical status calls do not add duplicate history.
- Admin-only reviewer assignment and staff role management. Direct staff-role writes stay blocked. Last admin cannot be removed through the management RPC.
- Submission checks for configured fields, Business keys, current official disclosures and configured uploaded documents. Acknowledgments store server-controlled disclosure text/version and signer name. This is an acknowledgment record, not a separately certified e-signature service.
- Submission retries remain idempotent even after review starts. Submitted details cannot be changed by applicants.
- Authorized, paginated queue with name/application-ID search, status and date filtering.
- Private file policies: owners can upload only to their own draft's folder; owners/assigned reviewers/admins can read. No client overwrite/delete. Document references must point to a real Storage object under the same application.
- Database audit triggers from your previous migration continue recording mutations. Audit viewing stays admin-only. Reads/downloads/logins/denied attempts are not logged by these triggers.

## Important completion boundary

We cannot honestly mark all database work complete merely because these scripts run. Completion requires: migrations installed in YOUR Supabase project; all SQL tests passing; approved submission configuration and status workflow; updated ten-table ERD/data dictionary saved in the team's repo; and real authenticated API verification. You already have an earlier four-table ERD, which needs updating if it is still your official diagram.

After that you can say: **"The database schema, database workflow functions, access policies and database tests are complete for our agreed scope. Frontend integration and end-to-end testing remain."**

Scoring formulas/approved rating categories, email delivery/retries and the legal adequacy of e-signature requirements still need their named owners. They are not implemented by this package. The original risk_evaluations.rating constraint is A+/A/B/C/D: the scoring owner must compare it with the CURRENT client matrix before storing real results; older client notes used additional categories. No thresholds or mappings are guessed here.

The old starter's test_connection.py expected submission without details/consent and fictional document paths. Those assumptions are intentionally no longer valid; use this package's tests instead.

## Local validation evidence

The migrations were executed against the original four-table schema plus the ten-table expansion in an embedded PostgreSQL-compatible PGlite instance. Supabase auth.uid(), roles, and Storage metadata were modeled for testing; this was NOT your cloud project. Both new migrations also installed a second time successfully. 45 database checks passed, and the test transaction left zero fixture applications and restored the unconfigured submission setting. See VALIDATION.md. This does not test Supabase Auth issuance, PostgREST, actual file bytes, bucket MIME/size enforcement, network requests or multi-session concurrency.

References: https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/storage/security/access-control ; https://supabase.com/docs/guides/storage/schema/design
