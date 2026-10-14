import {mkdir,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {dayKey,nextDay,berlinDate} from '../core.mjs';
const API='https://api.rz.uni-potsdam.de/roomsapi/v1';
async function get(path){const response=await fetch(API+path,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`Uni API returned ${response.status}`);return response.json();}
const days=[];let day=dayKey();for(let i=0;i<7;i++){days.push(day);day=nextDay(day);}
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
const snapshots=[];
for(const day of days)for(const campus of ['2','3']){
 const query=new URLSearchParams({start:berlinDate(day).toISOString(),end:berlinDate(nextDay(day)).toISOString()});
 const [bookings,free]=await Promise.all([get(`/bookings/${campus}?day=${day}`),get(`/rooms/${campus}?${query}`)]);
 if(!Array.isArray(bookings)||!Array.isArray(free.rooms))throw Error('Unexpected Uni data format');
 const safe=bookings.map(({room,start,end})=>({room,start,end}));
 for(const b of safe)if(typeof b.room!=='string'||!b.room.startsWith(campus+'.')||typeof b.start!=='string'||typeof b.end!=='string')throw Error('Invalid booking');
 if(!free.rooms.every(r=>typeof r==='string'&&r.startsWith(campus+'.')))throw Error('Invalid room catalogue');
 snapshots.push({day,campus,bookings:safe,freeRooms:free.rooms,fetchedAt:new Date().toISOString()});
}
// Write only after every upstream request succeeded; a failed run preserves the previous complete dataset.
for(const snapshot of snapshots){const target=new URL(`../data/${snapshot.day}-${snapshot.campus}.json`,import.meta.url);const tmp=new URL(target+'.tmp');await writeFile(tmp,JSON.stringify(snapshot));await rename(tmp,target);}
for(const name of await readdir(new URL('../data/',import.meta.url)))if(/^\d{4}-\d{2}-\d{2}-[23]\.json$/.test(name)&&!days.some(d=>name.startsWith(d)))await unlink(new URL('../data/'+name,import.meta.url));
console.log(`Updated ${snapshots.length} campus-day snapshots. No names, event titles or credentials are published.`);
