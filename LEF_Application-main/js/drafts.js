// Uses the signed-in user's Supabase client; database policies enforce ownership.
export function readDraftFields(form) {
  const get = name => String(new FormData(form).get(name) ?? '').trim();
  const amount = Number(get('loanAmount'));
  if (!get('firstName') || !get('lastName') || !get('email'))
    throw new Error('Enter your first name, last name, and email before saving.');
  if (!['Personal', 'Business'].includes(get('loanType')))
    throw new Error('Choose Personal or Business under Loan details before saving.');
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Enter a loan amount greater than zero under Loan details before saving.');
  const nullableNumber = name => {
    if (!get(name)) return null;
    const value = Number(get(name));
    if (!Number.isFinite(value) || value < 0) throw new Error('Income and expenses must be zero or greater.');
    return value;
  };
  const state = get('state').toUpperCase();
  const zip = get('zip');
  if (state && !/^[A-Z]{2}$/.test(state)) throw new Error('Use a two-letter state abbreviation, such as TX.');
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) throw new Error('Enter a five-digit ZIP code, optionally followed by four digits.');
  return {
    profile: {first_name: get('firstName'), last_name: get('lastName'), email: get('email'), phone: get('phone') || null},
    application: {loan_type: get('loanType'), requested_amount: amount},
    details: {
      first_name: get('firstName'), last_name: get('lastName'), contact_email: get('email'),
      contact_phone: get('phone') || null, address_line1: get('address') || null,
      address_line2: get('addressExtra') || null, city: get('city') || null,
      state_code: state || null, postal_code: zip || null,
      monthly_income: nullableNumber('monthlyIncome'),
      employment_history: [{status: get('employmentStatus'), employer: get('employer')}],
      business_details: {}, demographics: {},
      sources_and_uses: [{purpose: get('loanPurpose'), description: get('loanDescription'), monthly_expenses: nullableNumber('monthlyExpenses')}]
    }
  };
}
function checked(result) { if (result.error) throw result.error; return result.data; }
export async function findDraft(client, userId) {
  const profile = checked(await client.from('applicants').select('id').eq('auth_user_id', userId).maybeSingle());
  if (!profile) return {profile: null, application: null, details: null};
  const rows = checked(await client.from('applications').select('id,loan_type,requested_amount,status')
    .eq('applicant_id', profile.id).eq('status', 'draft').order('created_at', {ascending: false}).limit(1));
  const application = rows[0] || null;
  const details = application ? checked(await client.from('application_details').select('*').eq('application_id', application.id).maybeSingle()) : null;
  return {profile, application, details};
}
export async function saveDraft(client, user, fields, state, submissionKey) {
  if (!state.profile) {
    const result = await client.from('applicants').insert({auth_user_id: user.id, ...fields.profile}).select('id').single();
    if (result.error?.code === '23505') {
      state.profile = checked(await client.from('applicants').select('id').eq('auth_user_id', user.id).single());
    } else state.profile = checked(result);
  }
  if (!state.application) {
    const result = await client.from('applications').insert({applicant_id: state.profile.id, submission_key: submissionKey, ...fields.application})
      .select('id,loan_type,requested_amount,status').single();
    if (result.error?.code === '23505') {
      state.application = checked(await client.from('applications').select('id,loan_type,requested_amount,status').eq('submission_key', submissionKey).single());
    } else state.application = checked(result);
  }
  // Keep the application reference immediately so a later details failure can be retried.
  const updated = checked(await client.from('applications').update(fields.application).eq('id', state.application.id)
    .eq('status', 'draft').select('id').single());
  if (!updated) throw new Error('This application is no longer editable. Reload the page.');
  const existing = checked(await client.from('application_details').select('application_id').eq('application_id', state.application.id).maybeSingle());
  const result = existing
    ? await client.from('application_details').update(fields.details).eq('application_id', state.application.id).select('application_id').single()
    : await client.from('application_details').insert({application_id: state.application.id, ...fields.details}).select('application_id').single();
  checked(result);
  state.details = fields.details;
  return state.application.id;
}
