# LEF staff dashboard — US-06, US-07, partial US-12

## What is included
- `staff-dashboard.html`: accessible queue with search, status and loan-type filters, responsive design, review links, and pagination controls.
- `staff-review.html`: borrower information, documents, history, and private risk-evaluation display.
- `staff.css` and `js/staff*.js`: UI and logic.
- **Demo mode is the default:** four clearly fictional applications; consumer/commercial sample scores are calculated by the existing `scoring/scoring.js` module. Fake documents are not downloadable.
- **Live mode is optional:** `staff-dashboard.html?mode=live` uses Tanak's `list_application_queue` RPC and Supabase signed-in session. `staff-review.html?mode=live&id=<UUID>` reads application details, documents, history, and stored score using RLS. It NEVER computes/saves real borrower scores in the browser.

## Run
From repository root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/staff-dashboard.html. Use **Review** to open sample details. Try search, filters, and review links. Run `npm test` to exercise scoring tests.

## Security & integration boundaries
- **Do not expose the staff prototype as a public entry point with real data.** A hidden link is not security. Supabase Auth + RLS/privileges must restrict all live reads and document downloads; confirm these with multiple test accounts.
- Live mode requires an existing signed-in staff session and the database migrations/RPCs applied. Existing borrower login currently does not establish a session. A trusted admin must set up staff roles and a real sign-in flow first.
- Demo-only status and scores are fictional and not saved. Live mode displays only **existing** server-generated/stored risk evaluations; no client-side score calculations are made for actual borrower data.
- Missing live scores display as “No evaluation recorded.” Do not infer a risk grade from application fields.
- Staff status-update button is deliberately disabled pending a verified authorized workflow.
- The live queue's loan-type filter currently applies to the fetched server page only; status/search are server-side, and the numbers show **loaded page statistics**, not database-wide totals. For global counts or loan-type filtering, extend the trusted backend RPC.
- Before a real client demo: verify staff access, RLS, row-level authorization, document storage access, signed-out failures, and scoring approval. Use fictional data only.

## Relevant repo contract
`database/docs/FRONTEND_HANDOFF.md` documents queue RPC and direct RLS reads. Do not store service-role/secret keys in the frontend.
