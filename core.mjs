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
export function analyze(data,{day,campus,now=true,minimum=60},current=new Date()) {
 if(!Array.isArray(data.bookings)||!Array.isArray(data.freeRooms)||data.day!==day||data.campus!==String(campus))throw Error('Unerwartete Daten der Universität.');
 const start=now&&day===dayKey(current)?new Date(Math.max(+berlinDate(day,'08:00:00'),Math.ceil(+current/60000)*60000)):berlinDate(day,'08:00:00');
 const end=berlinDate(day,'20:00:00');if(start>=end)return [];
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
