# LIFE Empowerment Fund — Loan Intake / Pre-Screen Prototype

This repository includes a borrower frontend, Supabase-backed draft/upload and staff review workflows, a draft consumer/commercial scoring calculator, and database migration scripts. **Demo workflows are not loan approvals.**

## Run

```bash
npm test
python3 -m http.server 8000
```

Visit http://localhost:8000 to view borrower login. Registration and application forms require Supabase Auth and a configured database. `staff.html` is the live staff review page, and requires an authorized staff account. `admin-demo.html` is a **fake-data UI prototype** and does not create users.

**Start with [the integration guide](docs/INTEGRATION_GUIDE.md)** for deployment prerequisites, known missing features, and the demo test checklist. Database setup: [START_HERE](database/docs/START_HERE.md). Scoring limitations: [scoring rules](docs/scoring-rules.md).

Never commit secret keys, applicant records, reviewer passwords, or private financial documents.
