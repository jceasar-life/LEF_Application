# Supabase authentication and deployment setup

## Confirm Email toggle

Supabase Dashboard > Authentication > Sign In / Providers > Email > **Confirm Email** (UI location may vary). Turning it off allows new users to receive a session immediately after signup. The form now displays an appropriate success message for both configurations; it deliberately signs out newly created sessions to preserve the existing sign-in flow.

**Recommendation:** Keep confirmation ON for real borrowers if reliable email delivery/redirects can be configured. Disabling it permanently permits account creation with email addresses the registrant does not control; this affects password recovery, notifications and identity assurance. Make the final decision with LEF. Prefer disabling it only on a staging Supabase project.

## Email confirmation not working

- In Authentication > URL Configuration, set the *Site URL* to the actual HTTPS deployment address and allow its callback paths.
- For local development, add `http://localhost:8000/**` to permitted redirect URLs. Your `register.html` passes `emailRedirectTo` pointing to `index.html` on the current origin.
- Test with an inbox you control; check whether the link is expired or redirects to an inaccessible `localhost` from another device.
- Configure production-grade SMTP before real accounts use the system; test rate limits, deliverability and password-reset messages.
- Do not paste user passwords, tokens or service-role keys into GitHub, logs or screenshots.

## App dependencies

- Website: simple static HTML/CSS/JS hosted over HTTPS (e.g. Netlify). A public deployment **does not** mean it is secure or production-ready.
- Supabase Auth: user accounts and email/redirect settings.
- Supabase Postgres: schema and policies. Check *which* migrations have run; do not blindly rerun all migrations.
- Supabase Storage: `lef-documents`, private; object policies use the `lef_private` helper functions; verify those functions and test with distinct accounts.
- Browser uses only the **publishable** Supabase key; never embed a service-role/secret key in frontend code.

## Tests to run in staging

1. Confirm-email ON: register accessible email, receive link, confirm, sign in.
2. Confirm-email OFF: register a separate fictional account, observe immediate creation, sign in normally.
3. Wrong password and nonexistent user: no data exposure.
4. Forgot-password / account recovery: **not yet implemented** in this supplied application, so it remains a launch blocker.
5. Borrower A cannot access borrower B's application or document via direct Supabase API requests.
6. Non-staff cannot execute staff RPCs or retrieve risk evaluation records.
7. Unconfirmed/suspended accounts do not improperly gain access.
