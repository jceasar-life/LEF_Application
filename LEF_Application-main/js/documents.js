export const DOCUMENT_TYPES = ['income','identity','business','other'];
const MIME = {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
export function validateDocument(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!MIME[extension] || (file.type && file.type !== MIME[extension])) throw new Error('Choose a PDF, JPG, or PNG file.');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Each file must be nonempty and no larger than 5 MB.');
  return {extension, contentType:MIME[extension]};
}
const check = result => {if (result.error) throw result.error;return result.data;};
export async function listDocuments(client, applicationId) {
  return check(await client.from('documents').select('id,document_type,storage_path,original_filename,uploaded_at')
    .eq('application_id',applicationId).order('uploaded_at',{ascending:true}));
}
export async function digestFile(file) {
  const hash = await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), n=>n.toString(16).padStart(2,'0')).join('');
}
// A job keeps its random path on retry. Never overwrite an existing object.
export async function uploadDocument(client, applicationId, file, type, job, checkpoint = () => {}) {
  const {contentType} = validateDocument(file);
  if (!DOCUMENT_TYPES.includes(type)) throw new Error('Choose a document type.');
  if (!job.path.startsWith(applicationId+'/')) throw new Error('Document belongs to a different draft.');
  const bucket = client.storage.from('lef-documents');
  if (!job.uploaded) {
    const result = await bucket.upload(job.path,file,{upsert:false,contentType});
    if (result.error) {
      // A timed-out previous request may have stored the object. Verify exact bytes
      // through the signed-in download policy before registering the same reference.
      const existing = await bucket.download(job.path);
      if (existing.error || await digestFile(existing.data) !== job.digest) throw result.error;
    }
    job.uploaded = true;
    checkpoint();
  }
  const metadata = {application_id:applicationId, document_type:type, storage_path:job.path, original_filename:file.name};
  const result = await client.from('documents').insert(metadata);
  if (result.error) {
    // Recover a response lost after the first metadata insert succeeded.
    const existing = await client.from('documents').select('id').eq('application_id',applicationId).eq('storage_path',job.path).maybeSingle();
    if (existing.error || !existing.data) throw new Error('File uploaded, but its application record is not confirmed. Keep this page open and click Upload selected files again. '+result.error.message);
  }
  job.complete = true;
  checkpoint();
  return job.path;
}
