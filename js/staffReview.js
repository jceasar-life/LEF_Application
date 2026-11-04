import { demoApplications } from './staffDemoData.js';
import { calculateScore } from '../scoring/scoring.js';
import { $, isLive, money, date, label, el, setMode, message } from './staffHelpers.js';
const id=new URLSearchParams(location.search).get('id');setMode();$('back').href='staff-dashboard.html'+(isLive?'?mode=live':'');
if(!id){message('Choose an application from the queue.','error')}else if(!isLive){const a=demoApplications.find(x=>x.application_id===id);if(!a)message('Sample application not found.','error');else render(a,a.scoring?calculateScore(a.scoring):null)}else{
 try{
  const {supabase}=await import('./supabaseClient.js');
  const {data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw Error('You must sign in with an authorized LEF staff account.');
  const [appR,detailR,docsR,historyR,scoreR]=await Promise.all([
   supabase.from('applications').select('id,applicant_id,loan_type,requested_amount,status,submitted_at').eq('id',id).single(),
   supabase.from('application_details').select('*').eq('application_id',id).maybeSingle(),
   supabase.from('documents').select('id,original_filename,document_type,storage_path').eq('application_id',id),
   supabase.from('application_status_history').select('new_status,changed_at').eq('application_id',id).order('changed_at',{ascending:false}),
   supabase.from('risk_evaluations').select('evaluation_status,total_points,rating,criterion_results,evaluated_at').eq('application_id',id).order('evaluated_at',{ascending:false}).limit(1)
  ]);
  for(const r of [appR,detailR,docsR,historyR,scoreR])if(r.error)throw r.error;
  const app=appR.data;if(!app)throw Error('Application not found or not authorized.');
  const a={application_id:app.id,applicant_name:[detailR.data?.first_name,detailR.data?.last_name].filter(Boolean).join(' ')||'Applicant',loan_type:app.loan_type,requested_amount:app.requested_amount,status:app.status,submitted_at:app.submitted_at,details:detailR.data||{},documents:docsR.data||[],history:historyR.data||[]};
  render(a,scoreR.data?.[0]||null,true,supabase);message('Live information loaded using your staff account; access is enforced by Supabase policies.');
 }catch(e){message('Unable to load staff review: '+e.message,'error')}
}
function render(a,scoring,live=false,supabase){
 $('application-id').textContent=a.application_id;$('application-status').className='pill '+a.status;$('application-status').textContent=label(a.status);
 const data=[['Applicant',a.applicant_name],['Loan type',a.loan_type==='Personal'?'Consumer':'Commercial'],['Requested amount',money(a.requested_amount)],['Status',label(a.status)],['Submitted',date(a.submitted_at)],['Contact email',a.details?.contact_email||'Not provided'],['Contact phone',a.details?.contact_phone||'Not provided']];
 $('details').replaceChildren();for(const [name,value] of data){const div=el('div'),dt=el('dt',name),dd=el('dd',value);div.append(dt,dd);$('details').append(div)}
 const docs=$('documents');docs.replaceChildren();if(!a.documents.length)docs.append(el('p','No documents recorded.','muted'));
 for(const d of a.documents){const row=el('div',undefined,'file-row');const left=el('div');left.append(el('strong',d.original_filename),el('div',d.document_type,'tiny'));row.append(left);if(live){const btn=el('button','Download','secondary');btn.type='button';btn.addEventListener('click',async()=>{btn.disabled=true;try{const {data,error}=await supabase.storage.from('lef-documents').download(d.storage_path);if(error)throw error;const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download=d.original_filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(e){message('Document download blocked: '+e.message,'error')}finally{btn.disabled=false}});row.append(btn)}else row.append(el('span','Sample only · no actual file','tiny'));docs.append(row)}
 const hist=$('history');hist.replaceChildren();if(!a.history.length)hist.append(el('p','No history recorded.','muted'));for(const h of a.history){const line=el('div',undefined,'factor');line.append(el('span',label(h.new_status)),el('small',date(h.changed_at)));hist.append(line)}
 const box=$('score');box.replaceChildren();if(!scoring){box.append(el('p','No evaluation recorded.','muted'));return}
 const isDraft=!live,points=isDraft?scoring.totalPoints:scoring.total_points, rating=isDraft?scoring.rating:scoring.rating;
 box.append(el('div',points===null||points===undefined?'Not yet rated':`${points} / 31`,'score'),el('div',rating?`Preliminary rating: ${rating}`:'Needs staff review / missing inputs','score-caption'));
 if(live)box.append(el('p',`Evaluation status: ${scoring.evaluation_status||'Unknown'}`,'sub'));
 const factors=isDraft?scoring.factors:Array.isArray(scoring.criterion_results)?scoring.criterion_results:[];
 if(factors.length){box.append(el('h2','Contributing factors'));for(const f of factors){const row=el('div',undefined,'factor'),name=el('div');name.append(el('strong',f.label||f.field||'Criterion'));if(isDraft)name.append(el('small',String(f.value??'Missing input')));const pts=f.points??f.score??null;row.append(name,el('strong',pts===null?'Needs review':`${pts}${f.maxPoints?` / ${f.maxPoints}`:''}`));box.append(row)}}else box.append(el('p','No factor breakdown is stored for this evaluation.','muted'));
 if(isDraft&&scoring.unresolved.length)box.append(el('p','Missing inputs: '+scoring.unresolved.join(', '),'notice error'));
}
