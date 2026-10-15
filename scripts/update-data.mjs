import {mkdir,writeFile,rename,readdir,unlink,readFile} from 'node:fs/promises';
import {dayKey,nextDay,berlinDate} from '../core.mjs';
import {pulsSnapshots} from './puls.mjs';
const API='https://api.rz.uni-potsdam.de/roomsapi/v1';
async function get(path){const response=await fetch(API+path,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`Uni API returned ${response.status}`);return response.json();}
const days=[];let day=dayKey();for(let i=0;i<7;i++){days.push(day);day=nextDay(day);}
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
let snapshots=[];const fallbackCampuses=new Set();
for(const day of days)for(const campus of ['2','3']){
 try {
  const query=new URLSearchParams({start:berlinDate(day).toISOString(),end:berlinDate(nextDay(day)).toISOString()});
  const [bookings,free]=await Promise.all([get(`/bookings/${campus}?day=${day}`),get(`/rooms/${campus}?${query}`)]);
  if(!Array.isArray(bookings)||!Array.isArray(free.rooms)||(!bookings.length&&!free.rooms.length))throw Error('Empty or invalid room inventory');
  const safe=bookings.map(({room,start,end})=>({room,start,end}));
  for(const b of safe)if(typeof b.room!=='string'||!b.room.startsWith(campus+'.')||typeof b.start!=='string'||typeof b.end!=='string')throw Error('Invalid booking');
  if(!free.rooms.every(r=>typeof r==='string'&&r.startsWith(campus+'.')))throw Error('Invalid room catalogue');
  snapshots.push({day,campus,bookings:safe,freeRooms:free.rooms,source:'mobileup',fetchedAt:new Date().toISOString()});
 } catch(error){fallbackCampuses.add(campus);console.warn('Uni API unavailable:',day,campus,error.message);}
}
if(fallbackCampuses.size){
 snapshots=snapshots.filter(s=>!fallbackCampuses.has(s.campus));
 snapshots.push(...await pulsSnapshots(days,[...fallbackCampuses]));
}
for(let i=0;i<snapshots.length;i++)if(snapshots[i].unavailable){
 try {const previous=JSON.parse(await readFile(new URL(`../data/${snapshots[i].day}-${snapshots[i].campus}.json`,import.meta.url),'utf8'));
 if(!previous.unavailable&&(previous.bookings?.length||previous.freeRooms?.length))snapshots[i]={...previous,upstreamUnavailable:true};
 }catch{}
}
// Failed sources never turn into a falsely valid empty inventory; retain a dated last-good snapshot when available.
for(const snapshot of snapshots){const target=new URL(`../data/${snapshot.day}-${snapshot.campus}.json`,import.meta.url);const tmp=new URL(target+'.tmp');await writeFile(tmp,JSON.stringify(snapshot));await rename(tmp,target);}
for(const name of await readdir(new URL('../data/',import.meta.url)))if(/^\d{4}-\d{2}-\d{2}-[23]\.json$/.test(name)&&!days.some(d=>name.startsWith(d)))await unlink(new URL('../data/'+name,import.meta.url));
console.log(`Updated ${snapshots.length} campus-day snapshots. No names, event titles or credentials are published.`);
