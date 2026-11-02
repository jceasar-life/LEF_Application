# LIFE frontend/backend integration contract

Use your framework's Supabase client with the project URL + publishable key and the signed-in user's session. Never put the database password, service-role/secret key, or trusted SQL Editor impersonation code in the frontend. RPCs derive identity from auth.uid(); never accept a caller-supplied acting user. Functions enforce authorization even if buttons are hidden in the UI.

The snippets below assume `supabase` is an initialized JavaScript Supabase client; they are examples to integrate into your existing app, not a standalone frontend. Always handle `{ error }` and show an appropriate message.

## Applicant workflow

1. Sign in through Supabase Auth.
2. Read own applicant profile. If absent, insert with auth_user_id=user.id, first_name,last_name,email. Do not create profiles in a signup trigger without adapting this workflow.
3. Create a draft, retaining the SAME submission_key UUID for retries. Do not send id,status,submitted_at,assigned_reviewer_id (column permissions reject them).

```js
const { data: draft, error } = await supabase.from('applications')
  .insert({ applicant_id: profileId, submission_key: savedSubmissionKey,
            loan_type: 'Personal', requested_amount: 1000 })
  .select().single();
// Duplicate submission_key: read the existing owned row by that key, don't invent a new key.
```

4. Insert application_details using application_id plus the form fields. Do not send created_at/updated_at. On subsequent saves UPDATE the existing row; a generic upsert can require extra INSERT column privileges, so use explicit insert/update.
5. Upload a NEW file to the private lef-documents bucket. Use `<application UUID>/<random UUID>.pdf` (or jpg/jpeg/png), without bucket prefix, leading slash or actual applicant name. Never use upsert:true. Then insert documents metadata: application_id,document_type,storage_path,original_filename. Upload and metadata registration are separate API operations: if metadata save fails, retry the same reference; report unresolved orphan objects for trusted maintenance. No applicant delete/overwrite is enabled.

```js
const path = `${applicationId}/${crypto.randomUUID()}.pdf`; // use the actual allowed file extension
const { error: uploadError } = await supabase.storage.from('lef-documents')
  .upload(path, file, { upsert: false });
if (uploadError) throw uploadError;
const { error: metadataError } = await supabase.from('documents').insert({
  application_id: applicationId, document_type: 'income',
  storage_path: path, original_filename: file.name
});
if (metadataError) throw metadataError;
```

6. Fetch current official disclosures with `get_required_disclosures`. Render their text and version. Require the user to actively acknowledge and type their name, then call acknowledge_disclosure with the exact displayed type/version. Don't submit text to be stored; the database uses its trusted copy. A version mismatch requires showing the updated disclosure again.
7. Call submit_application. Show validation errors; do not modify status directly. Submitted forms/files are frozen to applicants by this scope.

```js
await supabase.rpc('get_required_disclosures');
await supabase.rpc('acknowledge_disclosure', {
 p_application_id: applicationId, p_consent_type: displayedDisclosure.type,
 p_version: displayedDisclosure.version, p_signer_name: typedName
});
await supabase.rpc('submit_application', { p_application_id: applicationId });
```

## Staff queue / review

```js
const { data, error } = await supabase.rpc('list_application_queue', {
 p_status: null, p_search: searchText || null,
 p_from: null, p_to: null, p_limit: 25, p_offset: 0
});
```

Queue excludes drafts; dates use [p_from inclusive, p_to exclusive). Order: submission date descending then application UUID. Reviewers see their assigned applications; admins see all. Changing filters resets pagination offset. A visible draft in a direct detail query does not mean it should appear in the submitted queue.

Read detail tables by application_id through normal client queries. All reads retain RLS. Fetch application_details, documents and application_status_history separately to avoid frontend relationship-name ambiguity. Fetch risk_evaluations only for staff; applicants must not see internal scores. No evaluation row means "not evaluated", never invent a result.

Download files with `supabase.storage.from('lef-documents').download(storagePath)` using the signed-in session. If using short-lived signed URLs, treat them as bearer links: don't store them in database rows, email them or log them. They can remain usable until expiry even if assignment changes; authenticated download better reflects current access.

```js
await supabase.rpc('update_application_status', {
 p_application_id: applicationId, p_new_status: 'under_review',
 p_reason: 'Your application is now under review.'
});
```

Proposed allowed transitions: submitted -> under_review; under_review -> approved OR declined. These require team confirmation. p_reason is applicant-visible (1-1000 characters), not internal notes. Status updates do not automatically calculate scores or send email.

## Admin-only management

```js
await supabase.rpc('assign_reviewer', {
 p_application_id: applicationId, p_reviewer_id: reviewerUserId // null unassigns
});
await supabase.rpc('set_staff_role', {
 p_user_id: existingAuthUserId, p_role: 'reviewer', p_enabled: true
});
```

User must already exist through Auth; this is not a user-invitation API. Initial admin bootstrap remains trusted SQL Editor. Admins can SELECT staff_roles to list reviewer IDs but cannot query auth.users from the browser. Do not expose auth.users or service keys to retrieve staff emails. If UI requires a staff directory/invitations, backend owner must implement an approved minimal directory endpoint separately.

Read audit_events through the signed-in admin session, ordered by occurred_at and id, with pagination. Other roles see no audit rows. Audit records include table_name,record_key,operation,actor_user_id,occurred_at; they do not include old/new financial payloads. For an application's full trail, combine its history with related record IDs: not every audit row's record_key is the application UUID.

## Required integration evidence

Use fictional data: applicant A cannot read/write B; reviewer can read only assigned application; admin can read both; signed-out calls fail; incomplete submission fails; completed approved-config submission succeeds exactly once; status transition/history works; uploading own draft works; uploading another user's/submitted draft fails; owner/assigned reviewer/admin can download; unassigned users cannot. Test MIME/size rejection and error display. Verify direct private file URLs cannot be opened publicly. Never test with the service key, which bypasses RLS.

No new tables were added. Store migrations in the team's repo in numbered order after the original baseline; don't automatically rerun baseline scripts against the existing project.
