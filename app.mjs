import {analyze,dayKey,nextDay,clock} from './core.mjs';

const $=id=>document.getElementById(id);
function stored(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,String(value));}catch{}}
let campus=stored('room-campus','3');if(!['2','3'].includes(campus))campus='3';
let now=true,raw=null,requestId=0,controller=null,lastStarted=0;
$('day').value=dayKey();$('day').min=dayKey();let limit=dayKey();for(let i=0;i<6;i++)limit=nextDay(limit);$('day').max=limit;
$('seminars').checked=stored('room-seminars','true')==='true';
function syncControls(){document.querySelectorAll('[data-campus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campus===campus)));document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.mode==='now')===now)));$('halls').disabled=$('seminars').checked;}
function element(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
function render(){
 $('results').replaceChildren();$('count').textContent='';if(!raw)return;
 let rooms=analyze(raw,{day:$('day').value,campus,now,minimum:Number($('minimum').value)});
 const search=$('search').value.toLocaleLowerCase('de').trim();
 rooms=rooms.filter(r=>(!$('seminars').checked||r.name.toUpperCase().startsWith('S'))&&($('halls').checked||!r.name.toUpperCase().startsWith('H'))&&(!search||`${r.name} ${r.id} ${r.house}`.toLocaleLowerCase('de').includes(search)));
 $('count').textContent=`${rooms.length} Räume`;
 if(!rooms.length){$('results').append(element('div',`Keine passenden Zeitfenster. Versuche eine kürzere Mindestdauer${$('seminars').checked?' oder schalte den S-Filter aus':''}.`,'empty'));return;}
 for(const r of rooms){const card=element('article','','room');const heading=element('div','','room-heading');const title=element('div','');title.append(element('h3',r.name),element('p',`${r.house} · ${r.id}`));heading.append(title,element('span','unbelegt','available'));const slots=element('div','','slots');for(const s of r.slots){const slot=element('div',`${clock(s.start)}–${clock(s.end)}`,'slot');slot.append(element('small',`${Math.round((s.end-s.start)/60000)} Min.`));slots.append(slot);}card.append(heading,slots);$('results').append(card);}
}
async function load(){
 const id=++requestId;controller?.abort();controller=new AbortController();const activeController=controller;const signal=activeController.signal;
 lastStarted=Date.now();raw=null;render();$('refresh').disabled=true;$('status').className='';$('status').textContent='Neuester verfügbarer Datenstand wird geladen …';
 const deadline=setTimeout(()=>activeController.abort(),25000);
 try{
  const url=new URL(`data/${$('day').value}-${campus}.json`,location.href);url.searchParams.set('fresh',String(Date.now()));
  const response=await fetch(url,{cache:'no-store',signal,credentials:'omit'});if(!response.ok)throw Error('Die Uni-Raumdaten sind gerade nicht verfügbar. Bitte erneut versuchen.');
  const result=await response.json();if(id!==requestId)return;
  if(!result.fetchedAt||!Number.isFinite(Date.parse(result.fetchedAt)))throw Error('Der Datenstand ist unbekannt.');
  raw=result;render();$('status').textContent=`${campus==='3'?'Griebnitzsee':'Golm'} · ${new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${$('day').value}T12:00:00Z`))} · Datenstand ${clock(new Date(result.fetchedAt))} Uhr`;
  const age=Math.max(0,Math.round((Date.now()-Date.parse(result.fetchedAt))/60000));
  if(age>10){$('status').className='error';$('status').textContent+=` · ${age} Min. alt – GitHub-Aktualisierung verzögert.`;}
 }catch(error){if(id!==requestId)return;raw=null;render();$('status').className='error';$('status').textContent=error.name==='AbortError'?'Die Abfrage hat zu lange gedauert. Bitte erneut anstupsen.':error.message;}
 finally{clearTimeout(deadline);if(id===requestId)$('refresh').disabled=false;}
}
document.querySelectorAll('[data-campus]').forEach(b=>b.addEventListener('click',()=>{campus=b.dataset.campus;save('room-campus',campus);syncControls();load();}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{now=b.dataset.mode==='now';syncControls();if(raw)render();else load();}));
$('refresh').addEventListener('click',load);$('day').addEventListener('change',load);$('minimum').addEventListener('change',()=>{if(raw)render();});$('search').addEventListener('input',render);
$('seminars').addEventListener('change',()=>{save('room-seminars',$('seminars').checked);syncControls();render();});$('halls').addEventListener('change',render);
function resume(){if(document.visibilityState==='visible'&&Date.now()-lastStarted>1500){const today=dayKey();if($('day').value<today)$('day').value=today;$('day').min=today;load();}}
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});document.addEventListener('visibilitychange',resume);
syncControls();load();
