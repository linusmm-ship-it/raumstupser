export const zone = 'Europe/Berlin';
export function berlinParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
export function dayKey(date=new Date()) { const p=berlinParts(date); return `${p.year}-${p.month}-${p.day}`; }
export function berlinDate(day,time='00:00:00') {
  const desired=Date.parse(`${day}T${time}Z`); let guess=desired;
  for(let i=0;i<3;i++){const p=berlinParts(new Date(guess));const rendered=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);guess+=desired-rendered;}
  return new Date(guess);
}
export function nextDay(day) { return new Date(Date.parse(`${day}T12:00:00Z`)+86400000).toISOString().slice(0,10); }
export function clock(date) { return new Intl.DateTimeFormat('de-DE',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(date); }
export function gaps(busy,start,end,minimum) {
 let cursor=+start;const result=[];
 for(const slot of [...busy].sort((a,b)=>a.start-b.start)) {
  if(slot.end<=start||slot.start>=end)continue;
  const edge=Math.min(+slot.start,+end);
  if(edge-cursor>=minimum*60000)result.push({start:new Date(cursor),end:new Date(edge)});
  cursor=Math.max(cursor,Math.min(+slot.end,+end));
 }
 if(+end-cursor>=minimum*60000)result.push({start:new Date(cursor),end:new Date(+end)});
 return result;
}
export function analyze(data,{day,campus,now=true,minimum=60,from=null,to=null},current=new Date()) {
 if(!Array.isArray(data.bookings)||!Array.isArray(data.freeRooms)||data.day!==day||data.campus!==String(campus))throw Error('Unerwartete Daten der Universität.');
 const custom=from!==null||to!==null;
 if(custom&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(to)||from>=to))throw Error('Bitte eine gültige Von- und Bis-Uhrzeit wählen. Bis muss nach Von liegen.');
 const start=custom?berlinDate(day,from+':00'):now&&day===dayKey(current)?new Date(Math.max(+berlinDate(day,'08:00:00'),Math.ceil(+current/60000)*60000)):berlinDate(day,'08:00:00');
 const end=berlinDate(day,custom?to+':00':'20:00:00');if(start>=end)return [];
 if(custom)minimum=(end-start)/60000;

 const busy=new Map();
 for(const b of data.bookings) {
  if(typeof b.room!=='string'||!b.room.startsWith(`${campus}.`)||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(b.start)||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(b.end))throw Error('Ungültige Raumdaten.');
  const s=berlinDate(b.start.slice(0,10),b.start.slice(11));const e=berlinDate(b.end.slice(0,10),b.end.slice(11));
  if(!Number.isFinite(+s)||!Number.isFinite(+e)||e<=s)throw Error('Ungültige Zeitdaten.');
  if(!busy.has(b.room))busy.set(b.room,[]);busy.get(b.room).push({start:s,end:e});
 }
 for(const r of data.freeRooms){if(typeof r!=='string'||!r.startsWith(`${campus}.`))throw Error('Ungültiger Raumkatalog.');if(!busy.has(r))busy.set(r,[]);}
 return [...busy].map(([id,slots])=>{const parts=id.split('.');return {id,house:`Haus ${Number(parts[1])}`,name:parts.slice(2).join('.'),slots:gaps(slots,start,end,minimum)};}).filter(r=>r.slots.length).sort((a,b)=>a.slots[0].start-b.slots[0].start||a.id.localeCompare(b.id,'de',{numeric:true}));
}

export function roomActivity(dataset,room,current=new Date()) {
 if(!dataset||dataset.unavailable||dataset.day!==dayKey(current)||(!dataset.bookings?.length&&!dataset.freeRooms?.length))return {state:'unknown',current:[],next:[]};
 const bookings=dataset.bookings.filter(b=>b.room===room).map(b=>({...b,start:berlinDate(b.start.slice(0,10),b.start.slice(11)),end:berlinDate(b.end.slice(0,10),b.end.slice(11))}));
 const known=bookings.length>0||dataset.freeRooms.includes(room);
 if(!known)return {state:'unknown',current:[],next:[]};
 if(bookings.some(b=>!Number.isFinite(+b.start)||!Number.isFinite(+b.end)||b.end<=b.start))return {state:'unknown',current:[],next:[]};
 const unique=[...new Map(bookings.map(b=>[`${+b.start}/${+b.end}/${b.title||''}`,b])).values()].sort((a,b)=>a.start-b.start);
 const running=unique.filter(b=>b.start<=current&&current<b.end);
 return {state:running.length?'busy':'free',current:running,next:unique.filter(b=>b.start>current).slice(0,2)};
}

export function matchesCampusHouse(room,campus){
 const parts=room.id.split('.');
 return parts[0]===String(campus)&&Number(parts[1])===(String(campus)==='2'?70:6)&&(String(campus)==='2'||/^[SH]/i.test(room.name));
}

export function normalizeSearch(value){
 return String(value).toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/\p{M}/gu,'').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function editDistance(a,b){
 const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
 }return d[a.length][b.length];
}
export function searchMatch(query,text){
 const titles=new Set(['prof','professor','professorin','dr','doktor','doktorin','pd','habil','dipl']);
 const words=normalizeSearch(query).split(/\s+/).filter(w=>w&&!titles.has(w));if(!words.length)return null;
 const haystack=normalizeSearch(text),tokens=haystack.split(/\s+/);let score=0;
 for(const word of words){
  if(haystack.includes(word))continue;
  if(haystack.replace(/ /g,'').includes(word))continue;
  if(word.length<4)return null;
  const limit=word.length>=8?2:1;
  const cost=Math.min(...tokens.filter(t=>Math.abs(t.length-word.length)<=limit).map(t=>editDistance(word,t)));
  if(cost>limit)return null;score+=cost;
 }return score;
}
export function searchEvents(datasets,query,day=null,current=new Date()){
 const found=new Map();
 for(const data of Object.values(datasets)){
  if(!data||data.unavailable||(day&&data.day!==day))continue;
  for(const b of data.bookings||[]){
   const lecturers=Array.isArray(b.lecturers)?b.lecturers.filter(n=>typeof n==='string'):[];
   const score=searchMatch(query,[b.title||'',...lecturers].join(' '));if(score===null)continue;
   const start=berlinDate(b.start.slice(0,10),b.start.slice(11)),end=berlinDate(b.end.slice(0,10),b.end.slice(11));
   if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)continue;
   const state=start<=current&&current<end?'busy':start>current?'next':'ended';
   const event={...b,lecturers,start,end,state,matchScore:score,approximate:score>0,campus:String(data.campus),snapshot:data};
   found.set([b.room,+start,+end,b.title,lecturers.join('|')].join('/'),event);
  }
 }
 const rank={busy:0,next:1,ended:2};return [...found.values()].sort((a,b)=>a.matchScore-b.matchScore||rank[a.state]-rank[b.state]||(a.state==='ended'?b.start-a.start:a.start-b.start)||a.room.localeCompare(b.room,'de',{numeric:true}));
}
