const message = document.getElementById('status-message');
const list = document.getElementById('submitted-applications');
const labels = new Map([
  ['submitted', 'Submitted'],
  ['under_review', 'Under Review'],
  ['approved', 'Approved'],
  ['declined', 'Declined']
]);

function append(parent, tag, content) {
  const element = document.createElement(tag);
  element.textContent = content;
  parent.append(element);
  return element;
}

async function loadApplications() {
  const { supabase } = await import('./supabaseClient.js');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (!auth.user) {
    if (authError && authError.name !== 'AuthSessionMissingError' && authError.status !== 401) {
      throw authError;
    }
    location.replace('./index.html');
    return;
  }
  const { data: applicant, error: profileError } = await supabase.from('applicants')
    .select('id').eq('auth_user_id', auth.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!applicant) {
    message.textContent = 'You haven’t submitted an application yet.';
    return;
  }

  const { data: applications, error } = await supabase.from('applications')
    .select('id,status,loan_type,submitted_at,is_demo')
    .eq('applicant_id', applicant.id).not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  message.textContent = applications.length ? '' : 'You haven’t submitted an application yet.';

  await Promise.all(applications.map(async application => {
    const card = document.createElement('section');
    card.style.cssText = 'background:white;padding:1.25rem;margin:1rem 0;border:1px solid #ddd;border-radius:12px';
    append(card, 'h2', (application.is_demo ? 'TEST · ' : '') + application.loan_type + ' application');
    append(card, 'p', 'Status: ' + (labels.get(application.status) || application.status));
    append(card, 'p', 'Submitted ' + new Date(application.submitted_at).toLocaleDateString());
    append(card, 'p', 'Reference: ' + application.id);
    const staffMessage = append(card, 'p', 'Checking for a staff message…');
    list.append(card);

    const { data: update, error: historyError } = await supabase.from('application_status_history')
      .select('reason').eq('application_id', application.id)
      .eq('new_status', application.status).not('old_status', 'is', null)
      .neq('new_status', 'submitted').not('reason', 'is', null)
      .order('changed_at', { ascending: false }).order('id', { ascending: false })
      .limit(1).maybeSingle();
    staffMessage.textContent = historyError
      ? 'Staff message could not be loaded. Refresh to try again.'
      : update?.reason ? 'Message from staff: ' + update.reason : 'No message for this status yet.';
  }));
}

loadApplications().catch(() => {
  message.textContent = 'Couldn’t load your applications. Refresh to try again.';
});
