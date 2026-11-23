// Authentication for the applicant sign-in page.
const form = document.getElementById('signin-form');
const errorMessage = document.getElementById('signin-error');
const statusMessage = document.getElementById('signin-status');
let clientPromise;
function getClient() {
  // Lazy loading lets the page display a useful error if the SDK cannot load.
  return clientPromise ||= import('./supabaseClient.js').catch(error => {
    clientPromise = null;
    throw error;
  });
}
if (location.hash.includes('error=')) {
  const params = new URLSearchParams(location.hash.slice(1));
  errorMessage.textContent = params.get('error_description') || 'The confirmation link could not be used. Please try again.';
  history.replaceState(null, '', location.pathname + location.search);
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  email.value = email.value.trim();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  errorMessage.textContent = '';
  statusMessage.textContent = 'Signing in…';
  try {
    const { supabase } = await getClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value, password: password.value
    });
    if (error) throw error;
    password.value = '';
    const { data: roles, error: roleError } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('user_id', data.user.id);
    if (roleError) throw new Error('Unable to check your account role. Please sign in again.');
    const isStaff = roles.some(({ role }) => role === 'reviewer' || role === 'admin');
    location.assign(isStaff ? './staff.html' : './application.html');
  } catch (error) {
    errorMessage.textContent = error.message || 'Unable to sign in. Please try again.';
    statusMessage.textContent = '';
  } finally {
    button.disabled = false;
  }
});
