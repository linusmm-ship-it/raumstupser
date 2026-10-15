import {readFile} from 'node:fs/promises';
const base='https://puls.uni-potsdam.de/qisserver/rds';
const weekdays=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
function plain(text){return text.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();}
export function isoWeek(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return `${Math.ceil(((d-new Date(Date.UTC(y,0,1)))/86400000+1)/7)}_${y}`;}
export function parseWeek(html,room){
 const begin=html.indexOf('class="plan_rahmen"');if(begin<0||!html.includes(room.split('.').slice(0,2).join('.')+' - '))throw Error('PULS room plan missing');
 const grid=html.slice(begin);const headers=new Map();
 for(const [,content] of grid.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)){const text=plain(content);const m=text.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(m)headers.set(m[1],`${m[4]}-${m[3].padStart(2,'0')}-${m[2].padStart(2,'0')}`);}
 if(headers.size<5)throw Error('Dated PULS week headers missing');
 const bookings=[];let timed=0;
 for(const [,content] of grid.matchAll(/<td\b[^>]*class="notiz"[^>]*>([\s\S]*?)<\/td>/gi)){
  const text=plain(content);if(!weekdays.some(d=>text.startsWith(d+',')))continue;
  const m=text.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(!m||!headers.has(m[1]))throw Error('Unrecognized PULS booking time');
  const date=headers.get(m[1]);const start=m[2].padStart(5,'0'),end=m[3].padStart(5,'0');if(end<=start)throw Error('Unsupported PULS overnight booking');
  bookings.push({room,start:`${date} ${start}:00`,end:`${date} ${end}:00`});timed++;
 }
 const links=[...grid.matchAll(/<a\b[^>]*publishid=\d+[^>]*class="ver"[^>]*>/g)].length;
 if(links!==timed)throw Error(`PULS event count mismatch (${links} links / ${timed} times)`);
 return {dates:new Set(headers.values()),bookings};
}
export async function pulsSnapshots(days,campuses=['2','3']){
 const registry=JSON.parse(await readFile(new URL('./puls-rooms.json',import.meta.url),'utf8'));const weeks=[...new Set(days.map(isoWeek))];
 const snapshots=new Map();for(const day of days)for(const campus of campuses)snapshots.set(`${day}-${campus}`,{day,campus,bookings:[],freeRooms:[],source:'puls',unavailableRooms:0,fetchedAt:null});
 const tasks=registry.filter(r=>campuses.includes(r.room[0])).flatMap(room=>weeks.map(week=>({room,week})));
 let cursor=0;let successes=0;
 async function worker(){while(cursor<tasks.length){const {room,week}=tasks[cursor++];let plan=null;try{const params=new URLSearchParams({state:'wplan','raum.rgid':room.rgid,week,act:'Raum',pool:'Raum',show:'plan','P.vx':'lang'});const response=await fetch(base+'?'+params,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('PULS HTTP error');plan=parseWeek(await response.text(),room.room);successes++;}catch(e){console.warn('PULS room unavailable:',room.room,week,e.message);}
 for(const day of days.filter(d=>isoWeek(d)===week)){const snapshot=snapshots.get(`${day}-${room.room[0]}`);if(!plan||!plan.dates.has(day)){snapshot.unavailableRooms++;continue;}const bookings=plan.bookings.filter(b=>b.start.startsWith(day));snapshot.bookings.push(...bookings);if(!bookings.length)snapshot.freeRooms.push(room.room);}
 }}
 await Promise.all([worker(),worker(),worker()]);
 console.log(`PULS: ${successes}/${tasks.length} room-week plans parsed.`);
 const result=[...snapshots.values()];for(const s of result){s.fetchedAt=new Date().toISOString();if(!s.bookings.length&&!s.freeRooms.length){s.unavailable=true;s.message='Die Uni-Raumdaten sind derzeit nicht verfügbar. Es können keine freien Räume bestätigt werden.';}}
 return result;
}
