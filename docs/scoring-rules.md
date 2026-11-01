# LEF scoring rules — draft interpretation

Source: user-provided screenshots of **Summary of Loan Rating System**, **Consumer Loan Rating Categories**, and **Commercial Loan Rating Categories** (November 2026).

## Consumer (31 maximum points)
- FICO: >=700=5; 650–699=4; 600–649=3; 500–599=2; 0–499=1.
- Assets (months of expenses saved): >=3=7; >=2=5; >=1=3; 0–<1=1.
- Character (FOC coach recommendation): strong=8; medium=4; weak=1.
- Net income stability (months): >=3=6; >=2=4; >=1=2; 0–<1=1.
- Personal debt service coverage: >=2=5; >=1.5 and <2=3; <1.5=1.

## Commercial (31 maximum points)
- FICO: same as consumer (max 5).
- Collateral percentage: >=110%=6; 100–109.5%=4; 90–99.99%=2; 0–89.9%=0. **Ambiguous definition, see below.**
- Owner equity: >=20%=5; 5–19.9%=3; 1.5–4.9%=1; below 1.5% undefined.
- Character (FOC coach and/or CEI consultant): strong=5; medium=3; weak=1.
- Cash flow stability: >=24 months=5; 12–23 months=3; 0–11 months=1.
- Business debt service coverage: >=2=5; >=1.5 and <2=3; <1.5=1.

## Rating summary (not an automated lending decision)
| Band | Points | Reserve | Acceptable for approval per source | Monitoring |
|---|---:|---:|---|---|
| A+ | N/A | 0% | Yes | Annually |
| A | 23–31 | 5% | Yes | Annually |
| B | 19–22 | 10% | Yes | Semi-annually |
| C | 15–18 | 15% | Yes | Quarterly |
| D | 5–14 | 16–100% | No — reserved for deterioration after closing | Monthly or more often |

## Confirm with LEF before production
1. A+ has no numeric thresholds. Should it ever be assigned automatically?
2. Commercial collateral row says “loan to collateral value after discounts” but awards *more* points at *higher* percentages. Is numerator actually collateral / loan, or loan / collateral? **Do not use until resolved.**
3. Collateral point ranges leave fractional gaps (e.g., 89.95%, 109.75%). Are amounts rounded to one decimal, two decimals, or bucketed differently?
4. Owner equity <1.5% has no point value. What should happen?
5. Total score <5 is absent from summary. How should it be classified?
6. Exactly 1.5 debt-service coverage is shown in both `1.5–1.99` and `0–1.5`; implementation assigns it to the higher tier pending confirmation.
7. Define who supplies FICO, saved-expense months, coach recommendation, stable income/cash flow months, debt service coverage, equity, and collateral percentage.
8. Confirm if this pre-screen is for staff triage only and document human-review criteria. Never expose internal points to applicants.

## Gap in current LEF application questionnaire
The uploaded `LEF - Form Questions (2).xlsx` includes type of loan, annual gross revenue, monthly income, and other application questions, but does **not** directly request most scoring inputs listed above. Build a staff-only assessment entry process or agree on verifiable data sources; do not infer a FICO score from revenue.

## Technical note
Current scorer is a **standalone draft prototype**, not a Supabase integration. Authorized server-side use only. It produces factor explanations and requires every input to be supported. Integration must enforce staff authorization, persist the matrix version and factor results, and not treat the rating-table “acceptable” field as an automated approval.
