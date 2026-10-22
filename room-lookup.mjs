import {loadSnapshot,snapshotLabel} from './data-client.mjs?v=11';
import {dayKey,nextDay,clock,roomActivity,searchEvents,analyze} from './core.mjs?v=11';
const query=document.getElementById('lookup-query'),status=document.getElementById('lookup-status'),results=document.getElementById('lookup-results');
let lookupMode='all';
const lookupDay=document.getElementById('lookup-day');
function dateBounds(){const today=dayKey();lookupDay.min=today;let limit=today;for(let i=0;i<6;i++)limit=nextDay(limit);lookupDay.max=limit;if(!lookupDay.value||lookupDay.value<today)lookupDay.value=today;}
dateBounds();
const range=document.getElementById('lookup-range');
const requestedDay=()=>lookupMode==='room'?dayKey():lookupDay.value;
const weekSearch=()=>lookupMode!=='room'&&range.value==='week';
const requestKey=()=>weekSearch()?'week:'+dayKey():requestedDay();
let registry=[],datasets={},loadedDay=null,loadedAt=0,pending=null,revision=0,extraAvailable=false;
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
const normalize=s=>s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
async function json(path){const url=new URL(path,location.href);url.searchParams.set('fresh',Date.now());const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Raumdaten konnten nicht geladen werden.');return await response.json();}finally{clearTimeout(timeout);}}
async function load(){
 dateBounds();if(loadedDay===requestKey()&&Date.now()-loadedAt<(weekSearch()?180000:60000)&&Object.keys(datasets).length)return;if(pending)return pending;
 const key=requestKey(),needsTeaching=lookupMode!=='room',days=[weekSearch()?dayKey():requestedDay()];if(weekSearch())for(let i=0;i<6;i++)days.push(nextDay(days.at(-1)));
 pending=(async()=>{
  const rooms=await json('rooms.json');extraAvailable=false;if(requestKey()===key){registry=rooms;datasets={};}const tasks=days.flatMap(day=>['2','3'].map(campus=>({day,campus}))),data=[];let cursor=0;
  async function worker(){while(cursor<tasks.length){const {day,campus}=tasks[cursor++];let snapshot=null;try{snapshot=await loadSnapshot(day,campus);}catch{}data.push([days.length===1?campus:`${day}:${campus}`,snapshot]);if(requestKey()===key&&normalize(query.value).length>=2){datasets=Object.fromEntries(data);render();if(data.length<tasks.length)status.textContent+=' Weitere Tage werden geprüft …';}}}
  async function teaching(){if(!needsTeaching)return;try{const index=await json('data/teaching.json');let count=0;for(const s of index.snapshots||[]){if(!days.includes(s.day)||!['2','3'].includes(s.campus)||s.unavailable)continue;try{analyze(s,{day:s.day,campus:s.campus,now:false});if(!Number.isFinite(Date.parse(s.fetchedAt)))continue;data.push([`puls:${s.day}:${s.campus}`,{...s,delivery:'puls-index'}]);count++;}catch{}}if(requestKey()===key)extraAvailable=count>0;}catch{}}
  await Promise.all([worker(),worker(),worker(),worker(),teaching()]);registry=rooms;datasets=Object.fromEntries(data);loadedDay=key;loadedAt=Date.now();
 })().finally(()=>{pending=null;});return pending;
}
function eventRow(booking,label){const row=el('div','','event-row');row.append(el('span',`${label} · ${clock(booking.start)}–${clock(booking.end)} Uhr`,'event-time'),el('p',booking.title||'Belegt – Veranstaltungstitel nicht verfügbar','event-title'));if(Array.isArray(booking.lecturers)&&booking.lecturers.length)row.append(el('p',booking.lecturers.join(' · '),'event-lecturers'));
 if(booking.url){try{const u=new URL(booking.url);if(u.protocol==='https:'&&u.hostname==='puls.uni-potsdam.de'){const a=el('a','Veranstaltung in PULS ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}}catch{}}
 return row;
}
function renderPeople(){
 const matches=searchEvents(datasets,query.value,weekSearch()?null:requestedDay());
 const date=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit'}).format(new Date(requestedDay()+'T12:00:00Z'));
 const scope=weekSearch()?'in den nächsten 7 Tagen':`am ${date}`;
 status.textContent=matches.length?`${matches.length} ${matches.length===1?'Termin':'Termine'} ${scope} in beiden Campussen${matches.length>30?' · erste 30 Treffer':''}.`:'Keine veröffentlichten Termine gefunden. Versuche nur den Nachnamen oder einen Teil des Veranstaltungstitels. Personen ohne Lehrtermin im gewählten Zeitraum sind hier nicht enthalten.';
 if(matches.some(b=>b.approximate))status.textContent+=' Ähnliche Schreibweisen sind markiert.';
 for(const b of matches.slice(0,30)){
  const parts=b.room.split('.'),card=el('article','','room activity person-result'),heading=el('div','','room-heading'),title=el('div','');
  title.append(el('h3',b.lecturers.join(' · ')||b.title||parts.slice(2).join('.')),el('p',`Raum ${parts.slice(2).join('.')} · ${b.campus==='2'?'Golm':'Griebnitzsee'} · Haus ${Number(parts[1])} · ${b.room}`));
  heading.append(title,el('span',b.state==='busy'?'läuft gerade':b.state==='ended'?'beendet':dayKey(b.start)===dayKey()?'heute später':'geplant',`activity-badge ${b.state==='busy'?'busy':'unknown'}`));
  const eventDate=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit'}).format(b.start);
  card.append(heading);if(b.approximate)card.append(el('p','Ähnliche Schreibweise – bitte Namen prüfen','match-note'));card.append(eventRow({...b,lecturers:[]},eventDate));if(!b.lecturers.length)card.append(el('p','Kein Dozierendenname im veröffentlichten Plan.','activity-note'));
  card.append(el('p',snapshotLabel(b.snapshot),'lookup-stamp'));results.append(card);
 }
 if(Object.values(datasets).some(d=>!d||d.unavailable))status.textContent+=' Einige Tagesdaten sind gerade nicht prüfbar; die Treffer sind unvollständig.';
 if(!extraAvailable)status.textContent+=' Die ergänzenden PULS-Termine sind gerade nicht verfügbar; weitere Lehrpersonen können fehlen.';
 if(Object.values(datasets).some(d=>d&&!d.includesLecturers))status.textContent+=' Ein Ersatzstand enthält keine Dozierendennamen; dort ist nur der Veranstaltungstitel durchsuchbar.';
}
function render(){results.replaceChildren();const needle=normalize(query.value);if(needle.length<2){status.textContent='Mindestens 2 Zeichen eingeben. Suche nach Raum oder nach Name / Veranstaltung in beiden Campussen.';return;}
 if(lookupMode==='person'){renderPeople();return;}
 if(lookupMode==='all'){renderPeople();if(!/^(?:[sh]\s*\d|\d)/i.test(query.value.trim()))return;}
 const available=new Map(registry.map(r=>[r.room,r]));for(const data of Object.values(datasets)){if(!data)continue;for(const id of [...(data.freeRooms||[]),...(data.bookings||[]).map(b=>b.room)])if(!available.has(id))available.set(id,{room:id});}
 const fullNumber=query.value.trim().split(/[.\s]+/).length>=3;
 const matches=[...available.values()].filter(r=>normalize(fullNumber?r.room:r.room.split('.').slice(2).join('.')).includes(needle)).sort((a,b)=>{const an=a.room.split('.').slice(2).join('.'),bn=b.room.split('.').slice(2).join('.');return Number(normalize(bn)===needle)-Number(normalize(an)===needle)||a.room.localeCompare(b.room,'de',{numeric:true});});
 status.textContent=matches.length?`${matches.length} ${matches.length===1?'Raum':'Räume'} in beiden Campussen${matches.length>20?' · erste 20 Treffer':''}. Belegung laut Uni-Plan.`:'Kein Raum gefunden. Versuche die vollständige Raumnummer, z. B. 2.09.0.14.';
 for(const r of matches.slice(0,20)){
  const parts=r.room.split('.'),campus=parts[0],data=datasets[campus]||datasets[`${dayKey()}:${campus}`],activity=roomActivity(data,r.room),name=parts.slice(2).join('.');
  const card=el('article','','room activity');const heading=el('div','','room-heading');const text=el('div','');text.append(el('h3',name),el('p',`${campus==='2'?'Golm':'Griebnitzsee'} · Haus ${Number(parts[1])} · ${r.room}`));heading.append(text,el('span',activity.state==='busy'?'läuft gerade':activity.state==='free'?'laut Plan frei':'nicht prüfbar',`activity-badge ${activity.state}`));card.append(heading);
  if(activity.state==='unknown')card.append(el('p','Für diesen Raum liegen heute keine verlässlichen Daten vor.','activity-note'));
  else{for(const b of activity.current)card.append(eventRow(b,'Jetzt'));if(activity.state==='free')card.append(el('p','Aktuell keine Belegung im veröffentlichten Raumplan.','activity-note'));for(const b of activity.next)card.append(eventRow(b,'Danach'));if(!activity.next.length)card.append(el('p','Keine weiteren Termine heute im Raumplan.','activity-note'));}
  if(data?.fetchedAt)card.append(el('p',snapshotLabel(data),'lookup-stamp'));
  if(r.rgid){const link=el('a','Raumplan in PULS ↗','room-plan');link.href=`https://puls.uni-potsdam.de/qisserver/rds?state=wplan&act=Raum&pool=Raum&raum.rgid=${encodeURIComponent(r.rgid)}`;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
  results.append(card);
 }
 if(Object.values(datasets).some(d=>!d||d.unavailable))status.textContent+=' Ein Campus liefert derzeit keine verwertbaren Daten.';
}
async function search(){const id=++revision;if(normalize(query.value).length<2){results.replaceChildren();status.textContent='Mindestens 2 Zeichen eingeben. Suche nach Raum oder nach Name / Veranstaltung in beiden Campussen.';return;}results.replaceChildren();status.textContent=weekSearch()?'Lehrtermine beider Campusse für 7 Tage werden durchsucht …':'Uni-Termine beider Campusse werden geladen …';try{await load();if(id===revision&&loadedDay!==requestKey())await load();if(id===revision)render();}catch(error){if(id===revision){results.replaceChildren();status.textContent=error.message;}}}
query.addEventListener('input',search);document.getElementById('refresh').addEventListener('click',()=>{loadedDay=null;datasets={};if(query.value.trim())search();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){loadedDay=null;datasets={};if(query.value.trim())search();}});window.addEventListener('pageshow',e=>{if(e.persisted){loadedDay=null;datasets={};if(query.value.trim())search();}});
setInterval(()=>{if(document.visibilityState==='visible'&&query.value.trim()){if(loadedDay!==requestKey()||Date.now()-loadedAt>=(weekSearch()?180000:60000))search();else render();}},30000);

window.addEventListener('online',()=>{loadedDay=null;if(query.value.trim())search();});

function syncLookup(){
 dateBounds();document.getElementById('lookup-range-row').hidden=lookupMode==='room';document.getElementById('lookup-date-row').hidden=lookupMode==='room'||range.value==='week';
 document.querySelectorAll('[data-lookup-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lookupMode===lookupMode)));
 document.getElementById('lookup-label').textContent=lookupMode==='room'?'Raum in beiden Campussen suchen':'Person, Raum oder Veranstaltung suchen';
 query.placeholder=lookupMode==='room'?'z. B. S26, 0.14 oder 2.09.0.14':'Nachname, Veranstaltung oder Raum …';
}
document.querySelectorAll('[data-lookup-mode]').forEach(b=>b.addEventListener('click',()=>{lookupMode=b.dataset.lookupMode;loadedDay=null;syncLookup();search();}));
range.addEventListener('change',()=>{loadedDay=null;syncLookup();search();});
lookupDay.addEventListener('change',()=>{loadedDay=null;search();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')dateBounds();});

syncLookup();
