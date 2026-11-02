import { supabase } from './supabaseClient.js';

async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Session check failed:', error.message);
    return;
  }

  console.log(
    data.session ? 'A user is signed in.' : 'No user is signed in yet.'
  );
}

checkSession();