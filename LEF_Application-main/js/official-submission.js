// Official LEF submission and typed-name attestation.
// Backend is authoritative: disclosure text, versions, ownership, and final status
// are validated by existing Supabase RPCs from 03_Database_Workflows.sql.
const requiredTypes = loanType => loanType === 'Business'
  ? ['identity','income','business'] : ['identity','income'];

export function validSignerName(name, first, last) {
  const normalize = x => String(x || '').trim().replace(/\s+/g,' ').toLowerCase();
  return Boolean(normalize(first) && normalize(last) &&
    normalize(name) === normalize(`${first} ${last}`));
}
export function missingDocumentTypes(documents, loanType) {
  return requiredTypes(loanType).filter(type =>
    !documents.some(doc => doc.document_type === type));
}
export function validDisclosures(raw) {
  return Array.isArray(raw) && raw.length > 0 && raw.every(d =>
    typeof d.type === 'string' && d.type.trim() &&
    typeof d.version === 'string' && d.version.trim() &&
    typeof d.text === 'string' && d.text.trim());
}

export function createOfficialSubmission({form,getClient,getUser,getState,getPending,setPending,getDirty,clearDirty,saveDraft,listDocuments}) {
  const availability = document.getElementById('submission-availability');
  const disclosureContainer = document.getElementById('official-disclosures');
  const signer = document.getElementById('official-signer-name');
  const submit = document.getElementById('submit-official');
  const status = document.getElementById('official-submission-message');
  const display = msg => {status.textContent = msg;};
  let disclosures = [];
  let finished = false;
  let busy = false;
  const setReady = ready => {
    // Allow the borrower to type their name while disclosures are pending.
    // Never enable final submission until approved disclosures are loaded.
    signer.disabled = finished;
    submit.disabled = !ready || finished || busy;
  };

  async function refresh() {
    setReady(false);
    disclosureContainer.replaceChildren();
    disclosures = [];
    if (!getClient() || !getUser()) {
      availability.textContent = 'Sign in to access official submission.';
      return;
    }
    availability.textContent = 'Checking approved disclosure requirements…';
    const {data,error} = await getClient().rpc('get_required_disclosures');
    if (error || !validDisclosures(data)) {
      availability.textContent = 'Official submission is not available yet. LIFE Empowerment Fund must approve and configure its required disclosures. You can still save drafts and upload documents.';
      display('');
      return;
    }
    disclosures = data;
    for (const d of disclosures) {
      const section = document.createElement('section');
      section.className = 'review-section';
      const heading = document.createElement('h4');
      heading.textContent = d.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const fullText = document.createElement('p');
      fullText.className = 'disclosure-text';
      fullText.style.whiteSpace = 'pre-wrap';
      fullText.textContent = d.text; // Never interpret client disclosure content as HTML.
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'official-disclosure-checkbox';
      checkbox.dataset.type = d.type;
      label.append(checkbox, document.createTextNode(` I have read and acknowledge this disclosure (version ${d.version}).`));
      section.append(heading,fullText,label);
      disclosureContainer.append(section);
    }
    availability.textContent = 'Approved disclosures loaded. Please review and acknowledge each one.';
    setReady(true);
  }

  function checkRequiredFields() {
    const steps = [...form.querySelectorAll('.form-step')];
    for(let index=0;index<3;index++) {
      for(const field of steps[index].querySelectorAll('input, select, textarea')) {
        if(field.disabled || field.type === 'hidden') continue;
        if(!field.checkValidity()) {
          document.dispatchEvent(new CustomEvent('lef:go-to-step',{detail:{index}}));
          field.reportValidity();
          throw new Error(`Please correct the highlighted field in Step ${index+1} before submitting.`);
        }
      }
    }
  }

  async function submitApplication() {
    if(finished || busy || getPending() || !getClient() || !getUser()) return;
    busy=true;
    setReady(false);
    try {
      if(!disclosures.length) throw new Error('Approved disclosures are not configured.');
      checkRequiredFields();
      const name=signer.value.trim();
      if(!validSignerName(name,form.elements.namedItem('firstName').value,form.elements.namedItem('lastName').value)) {
        signer.focus();
        throw new Error('Your electronic signature must match the first and last name on the application.');
      }
      const unchecked=[...disclosureContainer.querySelectorAll('.official-disclosure-checkbox')].filter(c=>!c.checked);
      if(unchecked.length) {
        unchecked[0].focus();
        throw new Error('Read and acknowledge every required disclosure before submitting.');
      }
      const selection={};
      document.dispatchEvent(new CustomEvent('lef:get-selected-files',{detail:selection}));
      if(selection.files?.length) throw new Error('Please upload or remove your selected files before submitting.');
      const current=getState();
      if(!current?.application?.id) throw new Error('Save a draft and upload the required documents first.');
      const docs=await listDocuments(current.application.id);
      const missing=missingDocumentTypes(docs, form.elements.namedItem('loanType').value);
      if(missing.length) {
        document.dispatchEvent(new CustomEvent('lef:go-to-step',{detail:{index:3}}));
        throw new Error('Upload the following required document categories: '+missing.join(', '));
      }
      // Do not silently change a draft during signing. A borrower must save edits first.
      if(getDirty()) throw new Error('You have unsaved changes. Click Save draft, then return here to sign.');
      if(!window.confirm('Submit this application to LIFE Empowerment Fund for review? You cannot edit it afterward.')) return;
      const client=getClient();
      const id=current.application.id;
      display('Recording your acknowledgments…');
      for (const d of disclosures) {
        const {error}=await client.rpc('acknowledge_disclosure', {
          p_application_id:id,p_consent_type:d.type,p_version:d.version,p_signer_name:name
        });
        if(error) throw error;
      }
      display('Submitting application…');
      const {data,error}=await client.rpc('submit_application',{p_application_id:id});
      if(error) throw error;
      if(data!==id) throw new Error('The server did not confirm the submitted application ID.');
      finished=true;
      clearDirty();
      // Clear UI only after an authenticated backend success response.
      availability.textContent='Application submitted successfully.';
      display(`Application ${id} submitted successfully. LIFE Empowerment Fund will contact you after review. Submission is not an approval.`);
      for(const el of form.querySelectorAll('input,select,textarea,button')) el.disabled=true;
      const home=document.createElement('a');
      home.href='./application-status.html';
      home.textContent='View application status';
      home.className='btn-secondary';
      status.append(document.createElement('br'),home);
      // Leave sign-out enabled even though application is read-only.
      document.getElementById('sign-out').disabled=false;
    } catch(err) {
      display('Submission not completed: '+(err.message || 'Please try again.'));
    } finally {
      busy=false;
      setReady(disclosures.length > 0);
    }
  }
  submit.addEventListener('click',submitApplication);
  return {refresh};
}
