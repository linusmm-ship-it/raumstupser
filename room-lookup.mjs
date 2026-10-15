import {dayKey,clock,roomActivity} from './core.mjs?v=4';
const query=document.getElementById('lookup-query'),status=document.getElementById('lookup-status'),results=document.getElementById('lookup-results');
let registry=[],datasets={},loadedDay=null,loadedAt=0,pending=null,revision=0;
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
const normalize=s=>s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
async function json(path){const url=new URL(path,location.href);url.searchParams.set('fresh',Date.now());const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Raumdaten konnten nicht geladen werden.');return await response.json();}finally{clearTimeout(timeout);}}
async function load(){if(loadedDay===dayKey()&&Date.now()-loadedAt<60000&&Object.keys(datasets).length)return;if(pending)return pending;
 const requestDay=dayKey();
 pending=(async()=>{const [rooms,...data]=await Promise.all([json('rooms.json'),...['2','3'].map(async c=>{try{return [c,await json(`data/${requestDay}-${c}.json`)];}catch{return [c,null];}})]);registry=rooms;datasets=Object.fromEntries(data);loadedDay=requestDay;loadedAt=Date.now();})().finally(()=>{pending=null;});return pending;
}
function eventRow(booking,label){const row=el('div','','event-row');row.append(el('span',`${label} · ${clock(booking.start)}–${clock(booking.end)} Uhr`,'event-time'),el('p',booking.title||'Belegt – Veranstaltungstitel nicht verfügbar','event-title'));
 if(booking.url){try{const u=new URL(booking.url);if(u.protocol==='https:'&&u.hostname==='puls.uni-potsdam.de'){const a=el('a','Veranstaltung in PULS ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}}catch{}}
 return row;
}
function render(){results.replaceChildren();const needle=normalize(query.value);if(needle.length<2){status.textContent='Mindestens 2 Zeichen eingeben. Die Suche umfasst beide Campusse.';return;}
 const available=new Map(registry.map(r=>[r.room,r]));for(const data of Object.values(datasets)){if(!data)continue;for(const id of [...(data.freeRooms||[]),...(data.bookings||[]).map(b=>b.room)])if(!available.has(id))available.set(id,{room:id});}
 const fullNumber=query.value.trim().split(/[.\s]+/).length>=3;
 const matches=[...available.values()].filter(r=>normalize(fullNumber?r.room:r.room.split('.').slice(2).join('.')).includes(needle)).sort((a,b)=>{const an=a.room.split('.').slice(2).join('.'),bn=b.room.split('.').slice(2).join('.');return Number(normalize(bn)===needle)-Number(normalize(an)===needle)||a.room.localeCompare(b.room,'de',{numeric:true});});
 status.textContent=matches.length?`${matches.length} ${matches.length===1?'Raum':'Räume'} in beiden Campussen${matches.length>20?' · erste 20 Treffer':''}. Belegung laut Uni-Plan.`:'Kein Raum gefunden. Versuche die vollständige Raumnummer, z. B. 2.09.0.14.';
 for(const r of matches.slice(0,20)){
  const parts=r.room.split('.'),campus=parts[0],data=datasets[campus],activity=roomActivity(data,r.room),name=parts.slice(2).join('.');
  const card=el('article','','room activity');const heading=el('div','','room-heading');const text=el('div','');text.append(el('h3',name),el('p',`${campus==='2'?'Golm':'Griebnitzsee'} · Haus ${Number(parts[1])} · ${r.room}`));heading.append(text,el('span',activity.state==='busy'?'läuft gerade':activity.state==='free'?'laut Plan frei':'nicht prüfbar',`activity-badge ${activity.state}`));card.append(heading);
  if(activity.state==='unknown')card.append(el('p','Für diesen Raum liegen heute keine verlässlichen Daten vor.','activity-note'));
  else{for(const b of activity.current)card.append(eventRow(b,'Jetzt'));if(activity.state==='free')card.append(el('p','Aktuell keine Belegung im veröffentlichten Raumplan.','activity-note'));for(const b of activity.next)card.append(eventRow(b,'Danach'));if(!activity.next.length)card.append(el('p','Keine weiteren Termine heute im Raumplan.','activity-note'));}
  if(data?.fetchedAt){const d=new Date(data.fetchedAt);if(Number.isFinite(+d)){const age=Math.max(0,Math.round((Date.now()-d)/60000));card.append(el('p',`Datenstand ${clock(d)} Uhr${age>10?` · ${age} Min. alt`:''}${data.upstreamUnavailable?' · Uni-Abruf gestört':''}`,'lookup-stamp'));}}
  if(r.rgid){const link=el('a','Raumplan in PULS ↗','room-plan');link.href=`https://puls.uni-potsdam.de/qisserver/rds?state=wplan&act=Raum&pool=Raum&raum.rgid=${encodeURIComponent(r.rgid)}`;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
  results.append(card);
 }
 if(Object.values(datasets).some(d=>!d||d.unavailable))status.textContent+=' Ein Campus liefert derzeit keine verwertbaren Daten.';
}
async function search(){const id=++revision;if(normalize(query.value).length<2){results.replaceChildren();status.textContent='Mindestens 2 Zeichen eingeben. Die Suche umfasst beide Campusse.';return;}status.textContent='Raumbelegung beider Campusse wird geladen …';try{await load();if(id===revision)render();}catch(error){if(id===revision){results.replaceChildren();status.textContent=error.message;}}}
query.addEventListener('input',search);document.getElementById('refresh').addEventListener('click',()=>{loadedDay=null;datasets={};if(query.value.trim())search();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){loadedDay=null;datasets={};if(query.value.trim())search();}});window.addEventListener('pageshow',e=>{if(e.persisted){loadedDay=null;datasets={};if(query.value.trim())search();}});
setInterval(()=>{if(document.visibilityState==='visible'&&query.value.trim()){if(loadedDay!==dayKey()||Date.now()-loadedAt>=60000)search();else render();}},30000);
