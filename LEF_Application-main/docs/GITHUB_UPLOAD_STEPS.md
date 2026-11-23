# Upload this patch to GitHub

This ZIP was built from the previous LEF project snapshot, **not the current GitHub main branch**. Prefer the **patch-only ZIP** to avoid overwriting teammate edits.

1. In VS Code, from your existing repository, run `git status` and confirm it is clean.
2. Run `git switch main && git pull origin main && git switch -c feature/final-product-foundation`.
3. Extract the patch-only ZIP. Copy **individual files** into the existing project, preserving paths (`register.html`, `index.html`, `docs/...`). Do not replace whole `docs` or `js` folders.
4. Review `git diff`, `git status`, and `git diff --check`. Review for credentials and secrets before staging.
5. Run `npm test`. To preview: `python3 -m http.server 8000`, then visit `http://localhost:8000/register.html`.
6. Run `git add register.html index.html docs/FINAL_PRODUCT_NEXT_STEPS.md docs/AUTH_AND_SUPABASE_SETUP.md docs/RELEASE_TEST_CHECKLIST.md docs/GITHUB_UPLOAD_STEPS.md`.
7. Run `git diff --cached --check && git commit -m "Improve registration feedback and document production release plan"`.
8. Run `git push -u origin feature/final-product-foundation` and open a PR for review.

**No Supabase dashboard settings are changed by a GitHub push.** Email verification must be configured separately in Supabase; migration `07` also remains subject to database-owner review and staging application.
