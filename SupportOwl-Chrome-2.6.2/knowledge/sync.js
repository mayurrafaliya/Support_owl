(function(root){
'use strict';
const DAILY='rocket-source-daily',BATCH='rocket-source-batch',DAY=86400000;
function merge(existing,kind,incoming){
 const official=e=>e.rocketManaged&&(kind==='terms'?e.source==='https://www.rocket.new/terms-service':e.source?.startsWith('https://docs.rocket.new/'));
 const old=new Map(existing.filter(official).map(e=>[e.source,e]));
 return [...existing.filter(e=>!official(e)),...incoming.map(e=>{const previous=old.get(e.source);return {...e,id:previous?.id||e.id,updated:previous&&previous.contentHash===e.contentHash?previous.updated:e.updated};})];
}
function create({storage,alarms,sources,commit,now=Date.now}){
 let running;
 async function status(patch){const old=(await storage.get('sourceSync')).sourceSync||{};await storage.set({sourceSync:{...old,...patch}});}
 async function step(force=false){
  if(running)return running;
  running=(async()=>{try{
   let {sourceSyncJob:job,sourceSync:state}=await storage.get(['sourceSyncJob','sourceSync']);
   if(!job){if(!force&&state?.lastSuccess&&now()-state.lastSuccess<DAY)return;
    await status({lastAttempt:now(),status:'checking',error:''});
    // Save terms independently; a failed Docs crawl must not delay a valid policy update.
    const policy=await sources.entry({source:sources.TERMS},await sources.download(sources.TERMS),'terms');
    await commit('terms',[policy]);await status({termsCheckedAt:now()});
    const items=sources.catalogue(await sources.download(sources.INDEX));
    const existing=(await storage.get('entries')).entries||[];
    const count=existing.filter(e=>e.rocketManaged&&e.source?.startsWith(sources.DOCS+'/')).length;
    if(count&&items.length<count*0.8)throw Error('Docs catalogue unexpectedly shrank; existing Docs were kept.');
    job={items,cursor:0,entries:[],startedAt:now()};await storage.set({sourceSyncJob:job});
   }
   // Four bounded requests per worker invocation. Persist before the next alarm.
   const batch=job.items.slice(job.cursor,job.cursor+4);
   const entries=await Promise.all(batch.map(async item=>sources.entry(item,await sources.download(item.url),'docs')));
   job.entries.push(...entries);job.cursor+=batch.length;
   if(JSON.stringify(job.entries).length>6000000)throw Error('Docs index exceeded its safe size limit; existing Docs were kept.');
   if(job.cursor<job.items.length){await storage.set({sourceSyncJob:job});await status({status:'indexing',completed:job.cursor,total:job.items.length});await alarms.create(BATCH,{delayInMinutes:1});}
   else{await commit('docs',job.entries);await storage.remove('sourceSyncJob');await status({status:'ready',lastSuccess:now(),docsCheckedAt:now(),completed:job.cursor,total:job.items.length,error:''});}
  }catch(e){await storage.remove('sourceSyncJob');await status({status:'error',error:e.message});}finally{running=null;}})();return running;
 }
 async function ensure(){if(!await alarms.get(DAILY))await alarms.create(DAILY,{delayInMinutes:1,periodInMinutes:1440});const {sourceSyncJob:job,sourceSync:state}=await storage.get(['sourceSyncJob','sourceSync']);if(job||!state?.lastSuccess||now()-state.lastSuccess>=DAY)await alarms.create(BATCH,{delayInMinutes:1});}
 return {step,ensure,onAlarm:a=>[DAILY,BATCH,'rocket-source-manual'].includes(a.name)?step(a.name!==BATCH):Promise.resolve()};
}
root.SupportSourceSync={create,merge,DAILY,BATCH};
})(globalThis);
