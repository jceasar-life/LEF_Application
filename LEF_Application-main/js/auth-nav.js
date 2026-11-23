// Shows applicant-only navigation only when Supabase confirms an active session.
// Keep these links hidden by default in the HTML to prevent a signed-out flash.
import { supabase } from './supabaseClient.js';

const applicantLinks = document.querySelectorAll('[data-auth-only]');

function setApplicantNavigationVisible(visible) {
  applicantLinks.forEach(link => {
    link.hidden = !visible;
    if (visible) {
      link.removeAttribute('aria-hidden');
      link.removeAttribute('tabindex');
    } else {
      link.setAttribute('aria-hidden', 'true');
      link.setAttribute('tabindex', '-1');
    }
  });
}

// Fail closed: if the session cannot be verified, do not show the tab.
setApplicantNavigationVisible(false);

supabase.auth.getSession().then(({ data, error }) => {
  if (!error) setApplicantNavigationVisible(Boolean(data.session));
}).catch(() => setApplicantNavigationVisible(false));

supabase.auth.onAuthStateChange((_event, session) => {
  setApplicantNavigationVisible(Boolean(session));
});
