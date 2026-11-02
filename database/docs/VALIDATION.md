# Local validation results

Environment: embedded PostgreSQL-compatible PGlite, with minimal modeled Supabase auth.uid(), anon/authenticated roles, and Storage metadata. Not the live Supabase project.

- Original four-table migration and ten-table expansion installed.
- 03 and 04 installed and repeated successfully.
- All 45 checks below passed.
- Suite passed both before and after submission configuration.
- Test rollback removed fixture applications and restored the original configuration.
- Unedited configuration template rejected placeholders.
- Edited configuration template executed successfully with fictional local disclosure text.
- Table count remained exactly 10 in public.

Limitations: no real Auth tokens, API requests, file uploads/downloads, managed Supabase Storage internals, MIME/size enforcement, or multi-connection race testing. These require integration verification in your project.

| Check | Result |
|---|---|
| Admin assigns reviewer | PASS |
| Admin can read mutation audit | PASS |
| Admin sees both fixtures | PASS |
| Anonymous application read denied | PASS |
| Anonymous status RPC denied | PASS |
| Applicant A cannot see B fixture | PASS |
| Applicant A sees own fixture | PASS |
| Applicant B cannot see A details | PASS |
| Applicant B cannot see A fixture | PASS |
| Applicant B cannot submit A fixture | PASS |
| Applicant B sees own fixture | PASS |
| Applicant cannot call review status function | PASS |
| Applicant cannot change status directly | PASS |
| Applicant cannot promote self | PASS |
| Applicant cannot read audit log | PASS |
| Applicant cannot write roles directly | PASS |
| Applicant is not authorized to review | PASS |
| Approval records reviewer and reason | PASS |
| Audit writes denied | PASS |
| Cannot skip under review | PASS |
| Consent required before submission | PASS |
| Consent uses trusted disclosure text | PASS |
| Malformed upload path denied | PASS |
| Missing details block submission | PASS |
| Nonexistent file reference rejected | PASS |
| Other draft denies upload path | PASS |
| Own draft permits upload path | PASS |
| Queue contains assigned submitted fixture | PASS |
| Queue never exposes unassigned fixture | PASS |
| Queue respects status filter | PASS |
| Raw consent text cannot be inserted | PASS |
| Retry does not duplicate submission history | PASS |
| Review reason required | PASS |
| Review transition has one history event | PASS |
| Reviewer cannot assign applications | PASS |
| Reviewer cannot read admin audit log | PASS |
| Reviewer cannot see unassigned fixture | PASS |
| Reviewer cannot update unassigned application | PASS |
| Reviewer sees assigned fixture | PASS |
| Submission fails closed until configured | PASS |
| Submission succeeds | PASS |
| Submitted application denies uploads | PASS |
| Submitted details cannot be edited | PASS |
| Terminal state cannot be reopened | PASS |
| Wrong disclosure version denied | PASS |
