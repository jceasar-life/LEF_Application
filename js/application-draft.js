import {listDocuments, validateDocument, digestFile, uploadDocument} from './documents.js';
import {readDraftFields, findDraft, saveDraft} from './drafts.js';
const form = document.getElementById('application-form');
const button = document.getElementById('save-draft');
const message = document.getElementById('draft-message');
const signout = document.getElementById('sign-out');
let client, user, state;
const keys = new Map();
let pending = false;
let dirty = false;
form.addEventListener('input', event => {if(!event.target.closest('#client-preview-submission') && event.target.id !== 'official-signer-name' && !event.target.classList.contains('official-disclosure-checkbox')) dirty = true;});
window.addEventListener('beforeunload', event => {
  const selection = {};
  document.dispatchEvent(new CustomEvent('lef:get-selected-files',{detail:selection}));
  if (dirty || pending || selection.files?.length) {event.preventDefault(); event.returnValue = '';}
});
function set(name, value) {
  const field = form.elements.namedItem(name);
  if (field && value !== undefined && value !== null) field.value = value;
}
async function initialize() {
  button.disabled = true;
  // Lock fields while checking ownership and restoring the latest saved draft.
  const controls = [...form.querySelectorAll('input,select,textarea,button')];
  controls.forEach(control => {control.disabled = true;});
  try {
    ({supabase: client} = await import('./supabaseClient.js'));
    const result = await client.auth.getUser();
    if (result.error || !result.data.user) {
      location.replace('./index.html');
      return;
    }
    user = result.data.user;
    state = await findDraft(client, user.id);
    set('email', user.email);
    if (state.application) {
      set('loanType', state.application.loan_type);
      set('loanAmount', state.application.requested_amount);
      const d = state.details || {};
      const mapping = {firstName:'first_name', lastName:'last_name', email:'contact_email', phone:'contact_phone', address:'address_line1', addressExtra:'address_line2', city:'city', state:'state_code', zip:'postal_code', monthlyIncome:'monthly_income'};
      for (const [field, column] of Object.entries(mapping)) set(field, d[column]);
      const employment = d.employment_history?.[0] || {};
      set('employmentStatus', employment.status); set('employer', employment.employer);
      const use = d.sources_and_uses?.[0] || {};
      set('loanPurpose', use.purpose); set('loanDescription', use.description); set('monthlyExpenses', use.monthly_expenses);
      message.textContent = 'Your latest saved draft is ready. Unsaved file selections must be added again. Uploaded documents are listed in Step 4.';
    } else message.textContent = 'Signed in. Enter your name, email, loan type, and loan amount to save a draft. Other fields may be completed later.';
    controls.forEach(control => {control.disabled = false;});
    signout.disabled = false;
    button.disabled = false;
    dirty = false;
    await refreshDocuments();
  } catch (error) {
    message.textContent = 'Unable to load your draft: ' + (error.message || 'Connection failed. Please reload to retry.');
    signout.disabled = !client;
  }
}
button.addEventListener('click', async () => {
  if (pending || !user) return;
  pending = true;
  button.disabled = true;
  signout.disabled = true;
  // Prevent edits during the save, so success cannot hide newer unsaved changes.
  const fields = [...form.querySelectorAll('input,select,textarea')];
  try {
    const values = readDraftFields(form);
    fields.forEach(field => {field.disabled = true;});
    const storageKey = `lef-draft-submission:${user.id}`;
    let key = keys.get(user.id);
    if (!key) {
      try {key = sessionStorage.getItem(storageKey);} catch {}
      key ||= crypto.randomUUID();
      keys.set(user.id, key);
      try {sessionStorage.setItem(storageKey, key);} catch {}
    }
    message.textContent = 'Saving draft…';
    const id = await saveDraft(client, user, values, state, key);
    dirty = false;
    message.textContent = `Draft saved (${id}). It has not been submitted. Use Upload selected files to save documents.`;
  } catch (error) {
    message.textContent = 'Draft not fully saved: ' + (error.message || 'Please try again.');
  } finally {
    fields.forEach(field => {field.disabled = false;});
    pending = false;
    button.disabled = false;
    signout.disabled = false;
  }
});
signout.addEventListener('click', async () => {
  if (pending) return;
  if (dirty && !confirm('Leave without saving your latest changes?')) return;
  signout.disabled = true;
  try {
    const {error} = await client.auth.signOut({scope:'local'});
    if (error) throw error;
    dirty = false;
    location.replace('./index.html');
  } catch (error) {
    message.textContent = 'Unable to sign out: ' + error.message;
    signout.disabled = false;
  }
});


const uploadButton = document.getElementById('upload-documents');
const uploadMessage = document.getElementById('upload-message');
const uploadedList = document.getElementById('uploaded-documents');
async function refreshDocuments() {
  try {
    const documents = state.application ? await listDocuments(client,state.application.id) : [];
    uploadedList.replaceChildren();
    for (const doc of documents) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${doc.original_filename} (${doc.document_type}) `;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn-secondary';
      download.textContent = 'Download';
      download.addEventListener('click', async () => {
        download.disabled = true;
        try {
          const {data,error} = await client.storage.from('lef-documents').download(doc.storage_path);
          if (error) throw error;
          const url = URL.createObjectURL(data);
          const link = document.createElement('a');
          link.href = url; link.download = doc.original_filename;
          document.body.append(link); link.click(); link.remove();
          setTimeout(()=>URL.revokeObjectURL(url),1000);
        } catch (error) {uploadMessage.textContent = 'Download failed: '+error.message;}
        finally {download.disabled = false;}
      });
      item.append(label,download); uploadedList.append(item);
    }
    if (!documents.length) uploadedList.textContent = 'No uploaded documents yet.';
    document.dispatchEvent(new CustomEvent('lef:uploaded-documents',{detail:{documents}}));
    return true;
  } catch (error) {
    uploadMessage.textContent = 'Unable to load uploaded documents: '+error.message;
    return false;
  }
}
function draftKey() {
  const storageKey = `lef-draft-submission:${user.id}`;
  let key = keys.get(user.id);
  if (!key) {
    try {key = sessionStorage.getItem(storageKey);} catch {}
    key ||= crypto.randomUUID();
    keys.set(user.id,key);
    try {sessionStorage.setItem(storageKey,key);} catch {}
  }
  return key;
}
// Save path checkpoints so a metadata retry reuses the already-uploaded object.
const memoryJobs = new Map();
function getJob(applicationId, digest, type, extension) {
  const key = `lef-upload:${user.id}:${applicationId}:${digest}:${type}`;
  let job = memoryJobs.get(key);
  if (!job) {
    try {job = JSON.parse(sessionStorage.getItem(key));} catch {}
    if (!job || typeof job.path !== 'string' || job.digest !== digest || !job.path.startsWith(applicationId+'/'))
      job = {path:`${applicationId}/${crypto.randomUUID()}.${extension}`,digest,uploaded:false,complete:false};
    memoryJobs.set(key,job);
  }
  const checkpoint = () => {try {sessionStorage.setItem(key,JSON.stringify(job));} catch {}};
  checkpoint();
  return {job,checkpoint};
}
uploadButton.addEventListener('click', async () => {
  if (pending || !user) return;
  const detail = {};
  document.dispatchEvent(new CustomEvent('lef:get-selected-files',{detail}));
  const files = detail.files || [];
  if (!files.length) {uploadMessage.textContent = 'Choose one or more files first.'; return;}
  const type = document.getElementById('document-type').value;
  if (!['income','identity','business','other'].includes(type)) {uploadMessage.textContent = 'Choose a document type first.';return;}
  let values;
  try {files.forEach(validateDocument);values=readDraftFields(form);}
  catch(error){uploadMessage.textContent=error.message;return;}
  pending = true;
  // Freeze navigation and editing through the save/upload sequence.
  const controls=[...document.querySelectorAll('input,select,textarea,button')];
  const previous=controls.map(control=>control.disabled);
  controls.forEach(control=>{control.disabled=true;});
  let count=0;
  try {
    uploadMessage.textContent = 'Saving draft before uploading…';
    const applicationId=await saveDraft(client,user,values,state,draftKey());
    dirty=false;
    for(const file of files){
      uploadMessage.textContent=`Uploading ${count+1} of ${files.length}…`;
      const digest=await digestFile(file);
      const {extension}=validateDocument(file);
      const {job,checkpoint}=getJob(applicationId,digest,type,extension);
      // Recheck metadata on every attempt, including when a previous upload completed.
      await uploadDocument(client,applicationId,file,type,job,checkpoint);
      count++;
      document.dispatchEvent(new CustomEvent('lef:file-uploaded',{detail:{file}}));
    }
    const listed=await refreshDocuments();
    if(listed) uploadMessage.textContent=`Uploaded to your draft: ${files.map(file => file.name).join(", ")}.`;
    message.textContent='Draft saved. Uploaded files are listed under Supporting documents.';
  } catch(error){
    uploadMessage.textContent=`${count} of ${files.length} files uploaded. Upload stopped before completing ${files[count]?.name || 'the upload'}. ${error.message || 'Connection failed.'} Retry the remaining files with the same document type.`;
    await refreshDocuments();
  } finally {
    controls.forEach((control,index)=>{control.disabled=previous[index];});
    pending=false;
  }
});

// Official submission is a separate workflow. No test-submission or
// browser-only e-signature can change the status of a real application.
import {createOfficialSubmission, validSignerName} from './official-submission.js';
import {submitDemo} from './submission.js';
const officialSubmission = createOfficialSubmission({
  form,
  getClient: () => client,
  getUser: () => user,
  getState: () => state,
  getPending: () => pending,
  setPending: value => { pending = value; },
  getDirty: () => dirty,
  clearDirty: () => { dirty = false; },
  saveDraft: async () => {
    const fields = readDraftFields(form);
    return saveDraft(client, user, fields, state, draftKey());
  },
  listDocuments: async applicationId => listDocuments(client, applicationId)
});


// The database independently checks the test account and draft ownership.
const previewAccount = 'ecd54ad4-45bb-4fa2-9b9a-b085d07e93be';
const preview = document.getElementById('client-preview-submission');
const previewButton = document.getElementById('submit-client-preview');
const previewSigner = document.getElementById('preview-signer');
const previewAcknowledgment = document.getElementById('preview-acknowledgment');
const previewMessage = document.getElementById('preview-submission-message');

previewButton.addEventListener('click', async () => {
  if (preview.hidden || pending || user?.id !== previewAccount) return;
  const id = state?.application?.id;
  const selection = {};
  document.dispatchEvent(new CustomEvent('lef:get-selected-files', {detail: selection}));
  if (!id || dirty || selection.files?.length) {
    previewMessage.textContent = 'Save your draft and upload or remove any selected files before submitting.';
    return;
  }
  if (!previewAcknowledgment.checked) {
    previewMessage.textContent = 'Please acknowledge the sample application first.';
    previewAcknowledgment.focus();
    return;
  }
  if (!validSignerName(previewSigner.value, form.elements.namedItem('firstName').value,
      form.elements.namedItem('lastName').value)) {
    previewMessage.textContent = 'Type the first and last name shown on the sample application.';
    previewSigner.focus();
    return;
  }

  pending = true;
  const controls = [...form.querySelectorAll('input,select,textarea,button')];
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  previewMessage.textContent = 'Submitting sample application…';
  try {
    await submitDemo(client, id);
  } catch (error) {
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
    previewMessage.textContent = 'Test submission not confirmed: ' + (error.message || 'Please retry.');
    return;
  } finally {
    pending = false;
  }
  dirty = false;
  signout.disabled = false;
  previewMessage.textContent = `Sample application submitted. Reference: ${id}`;
  document.getElementById('preview-status-link').hidden = false;
});

initialize().then(() => {
  if (state && user?.id === previewAccount && new URLSearchParams(location.search).get('preview') === '1') {
    document.getElementById('official-submission-section').hidden = true;
    preview.hidden = false;
    previewButton.disabled = false;
    return;
  }
  officialSubmission.refresh();
});
