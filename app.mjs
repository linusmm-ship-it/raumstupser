document.getElementById('room-lookup').open=true;
import {loadSnapshot,snapshotLabel} from './data-client.mjs?v=10';
import {analyze,dayKey,nextDay,clock,matchesCampusHouse} from './core.mjs?v=10';

const $=id=>document.getElementById(id);
function stored(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,String(value));}catch{}}
let campus=stored('room-campus','3');if(!['2','3'].includes(campus))campus='3';
let houseOnly=stored(`room-house-${campus}`,'false')==='true';
let mode='now',raw=null,requestId=0,lastStarted=0;
$('day').value=dayKey();$('day').min=dayKey();let limit=dayKey();for(let i=0;i<6;i++)limit=nextDay(limit);$('day').max=limit;
function restoreCampusFilter(){ $('seminars').checked=stored(`room-seminars-${campus}`,campus==='3'?'true':'false')==='true'; }
restoreCampusFilter();
function syncControls(){
 $('house-only').textContent=campus==='2'?'Nur Haus 70':'Nur Haus 6';
 $('house-only').setAttribute('aria-pressed',String(houseOnly));
 $('house-hint').hidden=!houseOnly;
 $('house-hint').textContent=campus==='2'?'Nur Räume in 2.70 · alle Raumtypen':'Nur Haus 6 · Seminarräume und Hörsäle';
 document.querySelector('.filters').hidden=houseOnly;
document.querySelectorAll('[data-campus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campus===campus)));document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('halls').disabled=$('seminars').checked;$('time-window').hidden=mode!=='custom';$('minimum').disabled=mode==='custom';$('minimum').closest('label').hidden=mode==='custom';$('day').closest('.two').classList.toggle('date-only',mode==='custom');}
function element(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
function render(){
 $('results').replaceChildren();$('count').textContent='';if(!raw)return;
 let rooms;
 try{rooms=analyze(raw,{day:$('day').value,campus,now:mode==='now',minimum:Number($('minimum').value),...(mode==='custom'?{from:$('from-time').value,to:$('to-time').value}:{})});$('time-hint').textContent='Zeigt nur Räume, die den gesamten Zeitraum frei sind.';$('time-hint').className='';}
 catch(error){$('time-hint').textContent=error.message;$('time-hint').className='invalid';return;}

 const search=$('search').value.toLocaleLowerCase('de').trim();
 rooms=rooms.filter(r=>(houseOnly?matchesCampusHouse(r,campus):(!$('seminars').checked||r.name.toUpperCase().startsWith('S'))&&($('halls').checked||!r.name.toUpperCase().startsWith('H')))&&(!search||`${r.name} ${r.id} ${r.house}`.toLocaleLowerCase('de').includes(search)));
 $('count').textContent=`${rooms.length} ${rooms.length===1?'Raum':'Räume'}`;
 if(!rooms.length){$('results').append(element('div',mode==='custom'?'Kein passender Raum ist im gesamten gewählten Zeitraum frei. Ändere die Uhrzeiten oder die Raumfilter.':`Keine passenden Zeitfenster. Versuche eine kürzere Mindestdauer${!houseOnly&&$('seminars').checked?' oder schalte den S-Filter aus':''}.`,'empty'));return;}
 for(const r of rooms){const card=element('article','','room');const heading=element('div','','room-heading');const title=element('div','');title.append(element('h3',r.name),element('p',`${r.house} · ${r.id}`));heading.append(title,element('span','unbelegt','available'));const slots=element('div','','slots');for(const s of r.slots){const slot=element('div',`${clock(s.start)}–${clock(s.end)}`,'slot');slot.append(element('small',`${Math.round((s.end-s.start)/60000)} Min.`));slots.append(slot);}card.append(heading,slots);$('results').append(card);}
}
async function load(){
 const id=++requestId;
 lastStarted=Date.now();raw=null;render();$('refresh').disabled=true;$('status').className='';$('status').textContent='Neuester verfügbarer Datenstand wird geladen …';
 try{
  const result=await loadSnapshot($('day').value,campus);if(id!==requestId)return;
  raw=result;render();$('status').className=result.delivery==='live'?'':'warning';
  $('status').textContent=`${campus==='3'?'Griebnitzsee':'Golm'} · ${snapshotLabel(result)}`;
 }catch(error){if(id!==requestId)return;raw=null;render();$('status').className='error';$('status').textContent=error.name==='AbortError'?'Die Abfrage hat zu lange gedauert. Bitte erneut anstupsen.':error.message;}
 finally{if(id===requestId)$('refresh').disabled=false;}
}
document.querySelectorAll('[data-campus]').forEach(b=>b.addEventListener('click',()=>{campus=b.dataset.campus;save('room-campus',campus);houseOnly=stored(`room-house-${campus}`,'false')==='true';restoreCampusFilter();syncControls();load();}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;syncControls();if(raw)render();else load();}));
$('house-only').addEventListener('click',()=>{houseOnly=!houseOnly;save(`room-house-${campus}`,houseOnly);if(houseOnly)$('search').value='';syncControls();render();});
$('refresh').addEventListener('click',load);$('day').addEventListener('change',load);$('minimum').addEventListener('change',()=>{if(raw)render();});$('search').addEventListener('input',render);
$('seminars').addEventListener('change',()=>{save(`room-seminars-${campus}`,$('seminars').checked);syncControls();render();});$('halls').addEventListener('change',render);
function resume(){if(document.visibilityState==='visible'&&Date.now()-lastStarted>1500){const today=dayKey();if($('day').value<today)$('day').value=today;$('day').min=today;let limit=today;for(let i=0;i<6;i++)limit=nextDay(limit);$('day').max=limit;load();}}
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastStarted>=60000)resume();},30000);
syncControls();load();

for(const id of ['from-time','to-time'])$(id).addEventListener('input',()=>{if(raw)render();});
