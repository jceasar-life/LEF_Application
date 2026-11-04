import { demoApplications } from './staffDemoData.js';
import { $, isLive, money, date, label, el, setMode, message } from './staffHelpers.js';
let supabase; let rows=[]; let offset=0; const PAGE=25;
setMode();
if(isLive){
 try {
  ({supabase} = await import('./supabaseClient.js'));
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user) throw new Error('Please sign in with an authorized LEF staff account before opening live mode.');
  await loadLive();
 } catch(err){message(err.message,'error');$('applications').replaceChildren(el('tr'));$('applications').firstChild.append(Object.assign(el('td',err.message,'empty'),{colSpan:6}));}
}else{rows=demoApplications;render();}
function render(){
 const search=$('search').value.trim().toLowerCase(),status=$('status').value,type=$('loan-type').value;
 const filtered=rows.filter(a=>(!status||a.status===status)&&(!type||a.loan_type===type)&&(!search||`${a.applicant_name} ${a.application_id}`.toLowerCase().includes(search)));
 const t=$('applications');t.replaceChildren();
 if(!filtered.length){const tr=el('tr');const td=el('td','No applications match your filters.','empty');td.colSpan=6;tr.append(td);t.append(tr)}
 filtered.forEach(a=>{const tr=el('tr');const tdName=el('td');tdName.append(el('strong',a.applicant_name),el('div',a.application_id,'tiny'));const statusCell=el('td');statusCell.append(el('span',label(a.status),'pill '+a.status));const link=el('a','Review','btn secondary');link.href='staff-review.html?'+new URLSearchParams({id:a.application_id,...(isLive?{mode:'live'}:{})});const linkCell=el('td');linkCell.append(link);tr.append(tdName,el('td',a.loan_type==='Personal'?'Consumer':'Commercial'),el('td',money(a.requested_amount)),statusCell,el('td',date(a.submitted_at)),linkCell);t.append(tr)});
 $('total').textContent=rows.length;$('review').textContent=rows.filter(a=>a.status==='under_review').length;$('submitted').textContent=rows.filter(a=>a.status==='submitted').length;$('count').textContent=`Showing ${filtered.length} of ${rows.length} loaded applications${isLive?' (server page of up to 25)':''}`;
 $('previous').disabled=!isLive||offset===0;$('next').disabled=!isLive||rows.length<PAGE;
}
async function loadLive(){
 const status=$('status').value||null,search=$('search').value.trim()||null;
 const {data,error}=await supabase.rpc('list_application_queue',{p_status:status,p_search:search,p_from:null,p_to:null,p_limit:PAGE,p_offset:offset});
 if(error)throw new Error(`Cannot load staff queue: ${error.message}`);
 rows=data||[];render();message('Live results are restricted by your signed-in Supabase staff permissions. Statistics represent the currently loaded page.');
}
let debounce;
for(const id of ['search','status','loan-type'])$(id).addEventListener(id==='search'?'input':'change',()=>{clearTimeout(debounce);debounce=setTimeout(async()=>{if(isLive){offset=0;try{await loadLive()}catch(e){message(e.message,'error')}}else render()},250)});
$('refresh').addEventListener('click',async()=>{if(isLive){try{await loadLive()}catch(e){message(e.message,'error')}}else render()});
for(const [id,delta] of [['next',PAGE],['previous',-PAGE]])$(id).addEventListener('click',async()=>{offset=Math.max(0,offset+delta);try{await loadLive()}catch(e){offset=Math.max(0,offset-delta);message(e.message,'error')}});
