(function(root){
'use strict';
let active=null,preferenceQueue=Promise.resolve();
function identity(sender){if(sender.id!==chrome.runtime.id||!Number.isInteger(sender.tab?.id)||sender.frameId!==0)throw Error('Writing assistance works in the main page only.');const u=new URL(sender.url);if(!['http:','https:'].includes(u.protocol))throw Error('Open a normal website to use writing assistance.');return {origin:u.origin,key:sender.tab.id+':'+(sender.documentId||sender.url)};}
async function process(m,sender){
 if(m.type==='replyPriority'){
  if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('ai.html'))||typeof m.id!=='string'||m.id.length>80)throw Error('Invalid reply request.');
  const lease=(await chrome.storage.session.get('replyLease')).replyLease;
  if(m.action==='release'){if(lease?.id===m.id)await chrome.storage.session.remove('replyLease');return true;}
  if(m.action!=='acquire')throw Error('Invalid reply action.');
  if(lease&&lease.id!==m.id&&lease.until>Date.now())throw Error('Another reply is being generated. Stop it or wait for it to finish.');
  await chrome.storage.session.set({replyLease:{id:m.id,until:Date.now()+25000}});active?.controller.abort();return true;
 }
 const who=identity(sender),all=(await chrome.storage.local.get('writingSites')).writingSites||{};
 const ignored=(await chrome.storage.session.get('writingIgnored')).writingIgnored||[];
 const pref={enabled:all[who.origin]?.enabled!==false,dialect:'en-IN',ignored};
 if(m.type==='writingConfig')return pref;
 if(m.type==='writingIgnore'){
  if(typeof m.word!=='string'||! /^[A-Za-z'’]{2,40}$/.test(m.word))throw Error('Choose a word to ignore.');
  const words=[...new Set([...ignored,m.word.toLowerCase()])];if(words.length>1000)throw Error('The session word list is full.');
  await chrome.storage.session.set({writingIgnored:words});return {...pref,ignored:words};
 }
 if(m.type==='writingSettings'){
  const next={enabled:typeof m.enabled==='boolean'?m.enabled:pref.enabled,dialect:'en-IN'};
  await chrome.storage.local.set({writingSites:{...all,[who.origin]:next}});if(active?.origin===who.origin)active.controller.abort();return {...next,ignored};
 }
 if(m.type==='writingCancel'){if(active?.key===who.key&&active.requestId===m.requestId)active.controller.abort();return true;}
 if(!pref.enabled)throw Error('Enable writing assistance on this site first.');
 if(m.type==='spellingRun')return root.SupportSpelling.check(m.text,ignored);
 if(m.type!=='writingRun')throw Error('Unknown writing action.');
 if(typeof m.requestId!=='string'||!/^\d{1,20}$/.test(m.requestId))throw Error('Invalid writing request.');
 if(((await chrome.storage.session.get('replyLease')).replyLease?.until||0)>Date.now())return {deferred:true,edits:[]};
 if(active){if(active.key===who.key)active.controller.abort();else return {deferred:true,edits:[]};}
 const job={...who,requestId:m.requestId,controller:new AbortController()};active=job;
 try{return await SupportWritingEngine.run({...m,dialect:'en-IN'},job.controller.signal);}finally{if(active===job)active=null;}
}
function handle(m,sender){if(['writingSettings','writingIgnore','replyPriority'].includes(m.type)){const job=preferenceQueue.then(()=>process(m,sender));preferenceQueue=job.catch(()=>{});return job;}return process(m,sender);}
root.SupportWritingService={handle};
})(globalThis);
