import {dayKey,clock,analyze} from './core.mjs?v=9';
export const LIVE_URL='https://raumstupser-daten.spicy-finch-1813.chatgpt.site/api/day';
export function createLoader({fetcher=(...args)=>fetch(...args),storage=()=>globalThis.localStorage,now=()=>Date.now(),base=()=>location.href}={}){
 const pending=new Map();
 function valid(data,day,campus){
  if(data?.unavailable||data?.day!==day||data?.campus!==campus||!Array.isArray(data.bookings)||!Array.isArray(data.freeRooms)||(!data.bookings.length&&!data.freeRooms.length)||!Number.isFinite(Date.parse(data.fetchedAt))||Date.parse(data.fetchedAt)>now()+60000)throw Error('Ungültige oder leere Raumdaten.');
  analyze(data,{day,campus,now:false});return data;
 }
 function cached(day,campus){try{return valid(JSON.parse(storage().getItem(`room-data:${day}:${campus}`)),day,campus);}catch{return null;}}
 function remember(data){try{const s=storage();s.setItem(`room-data:${data.day}:${data.campus}`,JSON.stringify(data));for(let i=s.length-1;i>=0;i--){const key=s.key(i);if(key?.startsWith('room-data:')&&key.split(':')[1]<dayKey(new Date(now())))s.removeItem(key);}}catch{}}
 async function get(url,timeout,day,campus){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetcher(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Datenquelle nicht erreichbar.');return valid(await r.json(),day,campus);}finally{clearTimeout(timer);}}
 return function load(day,campus){
  campus=String(campus);const key=`${day}:${campus}`;if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   const live=new URL(LIVE_URL);live.search=new URLSearchParams({day,campus,fresh:String(now())});
   try{const data=await get(live,14500,day,campus);remember(data);return {...data,delivery:'live'};}catch{}
   const path=`data/${day}-${campus}.json`;
   const urls=[new URL(path,base()),new URL(`https://raw.githubusercontent.com/linusmm-ship-it/raumstupser/main/${path}`)];
   const results=await Promise.allSettled(urls.map(url=>{url.searchParams.set('fresh',String(now()));return get(url,7000,day,campus);}));
   const candidates=results.filter(r=>r.status==='fulfilled').map(r=>({...r.value,delivery:'github'}));
   const local=cached(day,campus);if(local)candidates.push({...local,delivery:'cache'});
   candidates.sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt));
   if(!candidates.length)throw Error('Die Uni ist gerade nicht erreichbar und es gibt keinen gespeicherten Stand für diesen Tag. Bitte später erneut anstupsen.');
   const best=candidates[0];remember(best);return best;
  })().finally(()=>pending.delete(key));pending.set(key,task);return task;
 };
}
export const loadSnapshot=createLoader();
export function snapshotLabel(data){
 const age=Math.max(0,Math.round((Date.now()-Date.parse(data.fetchedAt))/60000));
 const date=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit'}).format(new Date(data.fetchedAt));
 let text=data.delivery==='live'?'Live bei der Uni abgerufen':data.delivery==='cache'?'Gespeicherter Ersatzstand – Live-Abruf nicht erreichbar':'GitHub-Ersatzstand – Live-Abruf nicht erreichbar';
 text+=` · ${date}, ${clock(new Date(data.fetchedAt))} Uhr`;
 if(data.delivery!=='live')text+=` · ${age<60?`${age} Min.`:`${Math.floor(age/60)} Std. ${age%60} Min.`} alt`;
 if(data.source==='puls')text+=' · PULS';
 if(data.unavailableRooms)text+=` · ${data.unavailableRooms} Räume nicht prüfbar`;
 return text;
}
