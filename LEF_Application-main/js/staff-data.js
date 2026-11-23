export const statusLabels={submitted:'Submitted',under_review:'Under Review',approved:'Approved',declined:'Declined'};
export function nextStatuses(status){return status==='submitted'?['under_review']:status==='under_review'?['approved','declined']:[];}
export async function fetchQueue(client,{search='',status='all',offset=0}={}){
 const {data,error}=await client.rpc('list_application_queue',{p_status:status==='all'?null:status,p_search:search.trim()||null,p_limit:25,p_offset:offset});
 if(error)throw error;
 const rows=data||[];
 if(!rows.length)return rows;
 const flags=await client.from('applications').select('id,is_demo').in('id',rows.map(a=>a.application_id));
 // Migration 05 adds is_demo. Without it, the staff queue still works,
 // but no row is ever assumed to be a fictional test application.
 if(flags.error){
   if(flags.error.code === '42703' || /is_demo.*does not exist/i.test(flags.error.message || ''))
     return rows.map(a=>({...a,is_demo:false}));
   throw flags.error;
 }
 const demos=new Map((flags.data || []).map(a=>[a.id,a.is_demo]));
 return rows.map(a=>({...a,is_demo:demos.get(a.application_id)===true}));
}
export async function changeStatus(client,id,status,reason){
 if(!['under_review','approved','declined'].includes(status)||!reason.trim()||reason.length>1000)throw Error('Enter a reason of 1–1000 characters.');
 const {error}=await client.rpc('update_application_status',{p_application_id:id,p_new_status:status,p_reason:reason.trim()});
 if(error)throw error;
}
