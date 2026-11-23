# LEF final-product implementation plan

**Baseline:** This repository package is based on `LEF_Application_Texas_Document_Requirements.zip`, not on a freshly fetched GitHub `main` branch. Before merging, compare the PR against the current main branch. All live Supabase/database functionality requires testing in a separate staging project.

## What changed in this package

- `register.html` now distinguishes an immediately authenticated Supabase signup (when Confirm Email is OFF) from a signup awaiting confirmation. It does not unconditionally tell the user to check email.
- `index.html` no longer always claims email confirmation is required.
- Documentation added for staging, production gaps, acceptance tests, and safe GitHub integration.

**No SQL migrations were automatically executed.** No production lending workflow or regulated consent/credit authorization is represented as completed by this update.

## Highest-priority development work

| Priority | Work | Responsible area | Exit criteria |
|---|---|---|---|
| P0 | Create separate Supabase staging project | Database | Staging URL, publishable key, migrations and policies tested without production data |
| P0 | Verify authentication | Frontend + database | Register, sign in, sign out, recovery; redirects and email delivery work |
| P0 | Verify borrowers own only their records | Database | Two-account negative tests prevent cross-account reads and writes |
| P0 | Verify draft and private document uploads | Frontend + database | Save/resume; required documents uploaded, downloaded, and inaccessible to other borrowers |
| P0 | Agree on official LEF disclosures and submission rules | LEF + team | Approved consent text/versions, loan-specific fields and documentation |
| P0 | Implement official (not demo) submission | Database + frontend | Idempotent submission, server-side required fields/documents/consent, unique ID, audit trail and visible confirmation |
| P0 | Implement secure automated scoring | Scoring + database | LEF-approved matrices and missing inputs, trusted backend calculation, private saved result; no client-side borrower access |
| P0 | Verify staff role and review | Database + frontend | Staff see authorized applications/docs/scores, statuses persist and are audited |
| P1 | Email notifications and password recovery | Frontend + backend | Reliable confirmation, recovery, submission and status emails; no confidential score leakage |
| P1 | Deployment and handoff | Team + LEF | LEF-controlled domain, hosting, auth URLs, monitoring, backups, documented ownership and maintenance |

## Do not ship as production functionality

- `Submit TEST application` (`public.submit_demo_application`) and test-account allowlist in migration `05_Demo_Submission.sql`.
- `Finish preview` (does not officially submit).
- Disabled DocuSign demo controls (no deployed signing function in the supplied baseline).
- Browser-side, manually entered scoring: may assist internal testing, but not a trusted automated score.
- `admin-demo.html`: fictional data, not real account management.

## LEF decisions needed

1. Confirm Texas-only eligibility and what constitutes a Texas address.
2. Confirm identification, income, and business-loan documents, including retention and deletion policy.
3. Provide approved consent, e-signature and credit authorization language; determine whether credit checks are even performed.
4. Resolve ambiguous consumer/commercial scoring bands; establish version-control, approval, and what happens when data is missing.
5. Clarify staff assignment, status values, and customer communications.
6. Decide whether email confirmation is required for **real** applicants; if disabled, establish alternate safeguards for email ownership and secure recovery.

## How to work safely

1. Copy this patch into a **fresh clone** or up-to-date worktree of the current repo, on a feature branch.
2. Review `git diff`, run `npm test`, and use browser testing with **fictional** accounts.
3. Do not commit `.env`, passwords, service-role keys or actual applicant records.
4. Open a PR and obtain review from frontend and database owners.
5. Apply SQL only after Tanak checks dependencies, order, RLS and a rollback plan in staging.
6. Do not promote this branch to public production until the P0 exit criteria above are met.
