# LEF end-to-end release tests (record results with date and tester)

| Test | Expected result | Status |
|---|---|---|
| `npm test` | Six existing scoring tests pass | Run locally; does **not** prove DB integration |
| Register + sign in | Supabase user exists; registration messaging matches Confirm Email setting | Not verified for this patch |
| Save draft + reload | Application and fields persist for owner only | Not verified |
| Ten-digit phone | Nine/eleven digits blocked; ten accepted, including server enforcement at submission | Not verified |
| Texas selection | Texas only; server rejects non-TX at submission | Not verified |
| Required documents | Identity and income for Personal; add business for Business | Not verified |
| Storage | Files uploaded to private bucket, correct application, allowed MIME/size | Not verified |
| Cross-borrower access | A cannot retrieve B's record/file even by calling API manually | Not verified |
| Staff login/access | Only authorized staff can open queue and private score | Not verified |
| Official submission | Valid app saved once with approved disclosures, consent and unique ID | **Not implemented** |
| Automatic scoring | Trusted backend computes approved version and stores internal-only result | **Not implemented** |
| Password recovery | Verified reset/recovery works from hosted URL | **Not implemented** |
| Email alerts | Submission and status changes deliver notifications | **Not implemented** |
| Security/handoff | Logging, retention, backups, incident contact and LEF ownership documented | Not verified |

Use **fictional data** until live RLS, storage policies, retention and legal approval are independently verified.
