import { showDemoScoring } from './staff-scoring.js';
import { listDocuments } from './documents.js';
import {supabase} from './supabaseClient.js';
import {fetchQueue,changeStatus,statusLabels,nextStatuses} from './staff-data.js';
const $=s=>document.querySelector(s);
let rows=[],offset=0,selected=null,busy=false,generation=0;
const message=$('#staff-message');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString():'—';
const amount=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
function render(){
 const table=list=>list.length?`<div class="table-wrap"><table><thead><tr><th>APPLICATION ID</th><th>APPLICANT</th><th>SUBMITTED</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${list.map(a=>`<tr><td>${esc(a.application_id)}</td><td>${a.is_demo?"<strong>TEST — </strong>":""}${esc(a.applicant_name)}</td><td>${esc(date(a.submitted_at))}</td><td>${esc(amount(a.requested_amount))}</td><td><span class="pill ${esc(a.status.replaceAll('_', '-'))}">${esc(statusLabels[a.status]||a.status)}</span></td><td><button class="action-btn" data-review="${esc(a.application_id)}">Open</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-state">No submitted applications available in this page or filter. Applicant drafts are excluded.</p>';
 $('#applications-table').innerHTML=table(rows);
 const pending=rows.filter(a=>['submitted','under_review'].includes(a.status)).sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at));
 $('#review-queue').innerHTML=table(pending);$('#overview-queue').innerHTML=table(pending.slice(0,3));
 $('#decisions-table').innerHTML=table(rows.filter(a=>['approved','declined'].includes(a.status)));
 $('#total-count').textContent=rows.length;$('#pending-count').textContent=pending.length;$('#info-count').textContent='—';$('#decision-count').textContent=rows.filter(a=>['approved','declined'].includes(a.status)).length;
 $('#queue-page').textContent=`Page ${offset/25+1} · Counts and queues reflect this filtered page.`;
 $('#queue-prev').disabled=busy||offset===0;$('#queue-next').disabled=busy||rows.length<25;
}
async function load(){
 const run=++generation;busy=true;rows=[];render();message.textContent='Loading applications…';
 try{
 const result=await fetchQueue(supabase,{search:$('#application-search').value,status:$('#status-filter').value,offset});
 if(run!==generation)return;rows=result;message.textContent='Live submitted applications loaded. Drafts are excluded.';
 }catch(error){if(run!==generation)return;message.textContent='Unable to load staff queue: '+error.message+' Staff permission and the database queue function are required.';}
 finally{if(run===generation){busy=false;render();}}
}
async function loadReviewDetails(application) {
 const details = $('#review-details');
 const documents = $('#review-documents');
 details.textContent = 'Loading submitted details…';
 documents.textContent = 'Loading supporting documents…';

 const [detailResult, documentResult] = await Promise.allSettled([
  supabase.from('application_details')
   .select('contact_email,contact_phone,monthly_income,employment_history,sources_and_uses')
   .eq('application_id', application.application_id).maybeSingle(),
  listDocuments(supabase, application.application_id)
 ]);
 if (selected !== application || !$('#review-modal').classList.contains('show')) return;

 const detail = detailResult.value?.data;
 if (detailResult.status === 'rejected' || detailResult.value?.error) {
  details.textContent = 'Could not load submitted details.';
 } else if (!detail) {
  details.textContent = 'No submitted details available.';
 } else {
  const employment = detail.employment_history?.[0];
  const use = detail.sources_and_uses?.[0];
  const fields = [
   ['Email', detail.contact_email],
   ['Phone', detail.contact_phone],
   ['Monthly income', detail.monthly_income == null ? null : amount(detail.monthly_income)],
   ['Employment status', employment?.status],
   ['Employer', employment?.employer],
   ['Loan purpose', use?.purpose],
   ['Use of funds', use?.description]
  ];
  details.replaceChildren(...fields.map(([label, value]) => {
   const line = document.createElement('p');
   line.textContent = label + ': ' + (value || '—');
   return line;
  }));
 }
 if (documentResult.status === 'rejected') {
  documents.textContent = 'Could not load supporting documents.';
  return;
 }
 const files = documentResult.value;
 if (!files.length) {
  documents.textContent = 'No supporting documents uploaded.';
  return;
 }

 const heading = document.createElement('h3');
 heading.textContent = 'Supporting documents';
 const list = document.createElement('ul');
 const downloadStatus = document.createElement('p');
 downloadStatus.setAttribute('role', 'status');
 documents.replaceChildren(heading, list, downloadStatus);
 for (const file of files) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'action-btn';
  button.textContent = 'Download ' + file.original_filename;
  button.addEventListener('click', async () => {
   button.disabled = true;
   downloadStatus.textContent = '';
   try {
    const { data, error } = await supabase.storage.from('lef-documents').download(file.storage_path);
    if (error) throw error;
    if (selected !== application || !documents.contains(button)) return;
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.original_filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
   } catch {
    downloadStatus.textContent = 'Download failed. Try again.';
   } finally {
    button.disabled = false;
   }
  });
  item.append(button);
  list.append(item);
 }
}

function open(application){
 if(!application)return;
 selected=application;
 $('#modal-name').textContent=(selected.is_demo?'TEST — ':'')+selected.applicant_name;$('#modal-id').textContent=selected.application_id;
 $('#modal-details').innerHTML=`<div><small>Loan type</small>${esc(selected.loan_type)}</div><div><small>Requested amount</small>${esc(amount(selected.requested_amount))}</div><div><small>Submitted</small>${esc(date(selected.submitted_at))}</div><div><small>Current status</small>${esc(statusLabels[selected.status])}</div>`;
 const choices=nextStatuses(selected.status);$('#new-status').replaceChildren();
 for(const value of choices)$('#new-status').add(new Option(statusLabels[value],value));
 if(!choices.length)$('#new-status').add(new Option(statusLabels[selected.status],selected.status));
 $('#new-status').disabled=!choices.length;$('#save-review').disabled=!choices.length;$('#decision-reason').value='';$('#review-message').textContent=choices.length?'Enter an applicant-visible reason for this status change.':'This application has a final decision.';
 $('#review-modal').classList.add('show');$('#close-modal').focus();
 loadReviewDetails(selected);
 showDemoScoring($('#review-scoring'), selected, supabase);
}
function close(){if(busy)return;$('#review-modal').classList.remove('show');selected=null;}
$('#close-modal').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
$('#review-modal').addEventListener('click',e=>{if(e.target.id==='review-modal')close();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-review]');if(b)open(rows.find(a=>a.application_id===b.dataset.review));});
$('#save-review').addEventListener('click',async()=>{
 if(busy||!selected)return;busy=true;$('#save-review').disabled=true;
 try{await changeStatus(supabase,selected.application_id,$('#new-status').value,$('#decision-reason').value);busy=false;close();await load();message.textContent='Status saved through the database workflow.';}
 catch(error){$('#review-message').textContent='Status not confirmed: '+error.message+' Refresh the queue before retrying if the connection was interrupted.';}
 finally{busy=false;$('#save-review').disabled=!selected||!nextStatuses(selected.status).length;}
});
for(const b of document.querySelectorAll('[data-page],[data-go]'))b.addEventListener('click',()=>{
 const page=b.dataset.page||b.dataset.go;
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page));
 document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===page));

 $('#page-title').textContent=({overview:'Staff Dashboard',applications:'Loan Applications',review:'Review Queue',decisions:'Decisions'})[page];
});
$('#application-search').addEventListener('input',()=>{offset=0;load();});
$('#status-filter').addEventListener('change',()=>{offset=0;load();});
$('#queue-prev').addEventListener('click',()=>{offset=Math.max(0,offset-25);load();});
$('#queue-next').addEventListener('click',()=>{offset+=25;load();});
$('#queue-refresh').addEventListener('click',load);
$('.logout').addEventListener('click',async e=>{e.preventDefault();const {error}=await supabase.auth.signOut({scope:'local'});if(error){message.textContent=error.message;return;}location.replace('index.html');});
$('#today').textContent=new Date().toLocaleDateString();
async function initialize(){
 const {data,error}=await supabase.auth.getUser();if(error||!data.user){location.replace('index.html');return;}
 const role=await supabase.from('staff_roles').select('role').eq('user_id',data.user.id);
 if(role.error||!role.data?.some(r=>['reviewer','admin'].includes(r.role))){message.textContent='Staff access is required. Ask the project administrator to grant your account a staff role.';return;}
 $('.user-mini strong').textContent=data.user.email;$('.welcome h2').textContent='Welcome to your staff workspace';
 document.querySelectorAll('.avatar').forEach(a=>{a.textContent=data.user.email.slice(0,2).toUpperCase();});

 $('#staff-workspace').hidden=false;await load();
}
initialize().catch(()=>{message.textContent='Unable to verify staff access. Reload to retry.';});
