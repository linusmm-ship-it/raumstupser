import {readFile,writeFile} from 'node:fs/promises';
const base='https://puls.uni-potsdam.de/qisserver/rds';
const weekdays=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
function decode(text){const named={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',ndash:'–',mdash:'—'};return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key)=>key[0]==='#'?String.fromCodePoint(parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10)):named[key]??all);}
function plain(text){return decode(text.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
export function isoWeek(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return `${Math.ceil(((d-new Date(Date.UTC(y,0,1)))/86400000+1)/7)}_${y}`;}
export function parseWeek(html,room){
 const begin=html.indexOf('class="plan_rahmen"');if(begin<0||!html.includes(room.split('.').slice(0,2).join('.')+' - '))throw Error('PULS room plan missing');
 const grid=html.slice(begin);const headers=new Map();
 for(const [,content] of grid.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)){const text=plain(content);const m=text.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(m)headers.set(m[1],`${m[4]}-${m[3].padStart(2,'0')}-${m[2].padStart(2,'0')}`);}
 if(headers.size<5)throw Error('Dated PULS week headers missing');
 const events=[...grid.matchAll(/<a\b([^>]*publishid=(\d+)[^>]*class="ver"[^>]*)>([\s\S]*?)<\/a>/g)].map(m=>({index:m.index,title:plain(m[1].match(/\btitle="([^"]*)"/)?.[1]||m[3]),url:`https://puls.uni-potsdam.de/qisserver/rds?state=verpublish&status=init&vmfile=no&publishid=${m[2]}&moduleCall=webInfo&publishConfFile=webInfo&publishSubDir=veranstaltung`}));
 for(let i=0;i<events.length;i++){
  const block=grid.slice(events[i].index,events[i+1]?.index??grid.length);
  events[i].people=[...new Map([...block.matchAll(/<a\b[^>]*personal\.pid=(\d+)[^>]*>([^<]*)/gi)].map(m=>[m[1],{id:m[1],name:plain(m[2]).replace(/[,;]+$/,'').trim()}])).values()].filter(p=>p.name);
  events[i].lecturers=events[i].people.map(p=>p.name);
 }
 const bookings=[];let timed=0;
 for(const match of grid.matchAll(/<td\b[^>]*class="notiz"[^>]*>([\s\S]*?)<\/td>/gi)){
  const text=plain(match[1]);if(!weekdays.some(d=>text.startsWith(d+',')))continue;
  const m=text.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(!m||!headers.has(m[1]))throw Error('Unrecognized PULS booking time');
  const date=headers.get(m[1]);const start=m[2].padStart(5,'0'),end=m[3].padStart(5,'0');if(end<=start)throw Error('Unsupported PULS overnight booking');
  const event=events.filter(e=>e.index<match.index).at(-1);if(!event)throw Error("PULS event title missing");
  bookings.push({room,title:event.title,lecturers:event.lecturers,people:event.people,url:event.url,start:`${date} ${start}:00`,end:`${date} ${end}:00`});timed++;
 }
 const links=[...grid.matchAll(/<a\b[^>]*publishid=\d+[^>]*class="ver"[^>]*>/g)].length;
 if(links!==timed)throw Error(`PULS event count mismatch (${links} links / ${timed} times)`);
 return {dates:new Set(headers.values()),bookings};
}
export function parsePersonName(html){
 const field=key=>plain(html.match(new RegExp('<td\\b[^>]*headers="'+key+'"[^>]*>([\\s\\S]*?)<\\/td>','i'))?.[1]||'');
 const last=field('basic_1'),first=field('basic_3');
 if(!last||!first)throw Error('PULS full name unavailable');return first+' '+last;
}
export async function pulsSnapshots(days,campuses=['2','3']){
 const registry=JSON.parse(await readFile(new URL('./puls-rooms.json',import.meta.url),'utf8'));const weeks=[...new Set(days.map(isoWeek))];
 const snapshots=new Map();for(const day of days)for(const campus of campuses)snapshots.set(`${day}-${campus}`,{day,campus,bookings:[],freeRooms:[],source:'puls',includesLecturers:true,unavailableRooms:0,fetchedAt:null});
 const tasks=registry.filter(r=>campuses.includes(r.room[0])).flatMap(room=>weeks.map(week=>({room,week})));
 let cursor=0;let successes=0;
 async function worker(){while(cursor<tasks.length){const {room,week}=tasks[cursor++];let plan=null;try{const params=new URLSearchParams({state:'wplan','raum.rgid':room.rgid,week,act:'Raum',pool:'Raum',show:'plan','P.vx':'lang'});const response=await fetch(base+'?'+params,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('PULS HTTP error');plan=parseWeek(await response.text(),room.room);successes++;}catch(e){console.warn('PULS room unavailable:',room.room,week,e.message);}
 for(const day of days.filter(d=>isoWeek(d)===week)){const snapshot=snapshots.get(`${day}-${room.room[0]}`);if(!plan||!plan.dates.has(day)){snapshot.unavailableRooms++;continue;}const bookings=plan.bookings.filter(b=>b.start.startsWith(day));snapshot.bookings.push(...bookings);if(!bookings.length)snapshot.freeRooms.push(room.room);}
 }}
 await Promise.all([worker(),worker(),worker()]);
 const namesURL=new URL('../data/teaching-people.json',import.meta.url);let names={};try{names=JSON.parse(await readFile(namesURL,'utf8'));}catch{}
 const people=new Map();for(const snapshot of snapshots.values())for(const booking of snapshot.bookings)for(const person of booking.people||[])people.set(person.id,person);
 const missing=[...people.values()].filter(p=>!names[p.id]||Date.now()-Date.parse(names[p.id].checkedAt)>7*86400000);let personCursor=0;
 async function nameWorker(){while(personCursor<missing.length){const person=missing[personCursor++];try{const params=new URLSearchParams({state:'verpublish',status:'init',vmfile:'no',moduleCall:'webInfo',publishConfFile:'webInfoPerson',publishSubDir:'personal','personal.pid':person.id});const r=await fetch(base+'?'+params,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('PULS person unavailable');names[person.id]={name:parsePersonName(await r.text()),checkedAt:new Date().toISOString()};}catch{}}}
 await Promise.all(Array.from({length:6},nameWorker));
 for(const snapshot of snapshots.values())for(const booking of snapshot.bookings){booking.lecturers=[...new Set((booking.people||[]).map(p=>names[p.id]?.name||p.name))];delete booking.people;}
 await writeFile(namesURL,JSON.stringify(names));
 console.log(`PULS: ${successes}/${tasks.length} room-week plans parsed; ${people.size} public teaching names resolved where available.`);
 const result=[...snapshots.values()];for(const s of result){s.fetchedAt=new Date().toISOString();if(!s.bookings.length&&!s.freeRooms.length){s.unavailable=true;s.message='Die Uni-Raumdaten sind derzeit nicht verfügbar. Es können keine freien Räume bestätigt werden.';}}
 return result;
}
