# LEF integration guide (November 2026)

## What is included
- Borrower-facing sign-in, registration, drafts, file uploads and TEST submission UX.
- Supabase client using a **publishable** key (not an admin/secret key).
- Staff-only application queue, authorized application review, document downloads and status workflow.
- Consumer / commercial experimental scoring calculator for marked TEST applications only, with **no persisted score adjustment**.
- Database SQL migrations 01–05; do not assume these are installed in a live project.
- Separate `admin-demo.html`: **fictional UI prototype only**, with no real Supabase admin operations.

## Removed/disabled to avoid nonfunctional or duplicated features
- No duplicate `staff-dashboard.html` or `staff-review.html`; `staff.html` is the single live staff page.
- Removed unassigned/claim panel: missing `list_unassigned_applications` and `claim_application` RPCs. Existing `assign_reviewer` is an admin-only backend function; administrators must assign reviewers through an authorized workflow.
- Removed score adjustment persistence: missing `list_demo_score_history` and `save_demo_score_adjustment` RPCs. Experimental scoring is ephemeral and cannot alter credit decisions.
- DocuSign buttons disabled: `docusign-demo-sign` Edge Function was not supplied.
- Kept a separate, clearly labeled administration prototype at `admin-demo.html`. It is not authorization-protected and must not be linked into a production app.

## Test locally
Run from the project root:

```bash
npm test
python3 -m http.server 8000
```

Browse `http://localhost:8000/`. The staff page is `http://localhost:8000/staff.html` and requires a verified Supabase staff role.

## Supabase requirements
1. Have the database teammate verify current schema and apply migrations safely in a **nonproduction** Supabase project. Read `database/docs/START_HERE.md` and `database/docs/VALIDATION.md`. Earlier migration scripts may be one-time and are not guaranteed to be re-runnable.
2. Confirm email authentication settings and authorized redirect URLs in Supabase.
3. Configure a **private** `lef-documents` storage bucket and verify all Storage and table RLS policies with at least two applicant accounts plus reviewer/admin accounts.
4. Demo migration 05 has an embedded test-user UUID and only permits that test account to submit. Review/reconfigure it for your test environment; it does NOT implement official submissions. Do not expose real applicant data to test users.
5. Assign a reviewer via a trusted admin operation before expecting reviewer-only staff queues to show submitted records.
6. The actual scoring engine is NOT linked to real applicant financial data and has not been approved for automated lending decisions. No real credit approvals should be based on this demo.
7. Email delivery and DocuSign are not implemented by this package. Status messages are visible to the signed-in applicant in the app; they are not sent by email.

## Acceptance checks before client demo
- Borrower registration, email confirmation and login work.
- Draft persists after logout and login.
- Upload/download works with private test files.
- Demo submission appears in a staff-accessible queue.
- A second borrower cannot access the first person's records.
- Reviewer can view only authorized records; a nonstaff user cannot read staff data even via direct API calls.
- Staff status transition and reason display in the borrower's status page.
- Scoring sample only runs for `is_demo=true` records and is clearly marked as not saved.

Live runtime behavior cannot be verified without access to the deployed Supabase configuration and authenticated test accounts.
