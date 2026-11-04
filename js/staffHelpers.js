export const isLive = new URLSearchParams(location.search).get('mode') === 'live';
export const $ = id => document.getElementById(id);
export const money = n => n == null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const date = s => s ? new Date(s).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—';
export const label = s => ({submitted:'Submitted',under_review:'Under review',approved:'Approved',declined:'Declined',draft:'Draft'})[s] || String(s || 'Unknown').replaceAll('_',' ');
export const el = (tag, text, cls) => {const x=document.createElement(tag); if(text!==undefined)x.textContent=String(text); if(cls)x.className=cls;return x};
export function setMode(){const c=$('mode-chip');c.textContent=isLive?'LIVE · Staff account required':'DEMO · Fictional data';c.className='chip'+(isLive?' live':'');const b=$('mode-switch');if(b){b.href=isLive?'staff-dashboard.html':'staff-dashboard.html?mode=live';b.textContent=isLive?'Use demo data':'Try live staff mode'}}
export function message(msg,type='info'){const box=$('message');if(box){box.className='notice '+type;box.textContent=msg}}
