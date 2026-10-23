importScripts('knowledge/vendor/html-parser.js','knowledge/sources.js','knowledge/sync.js');
importScripts('core.js','pets.js','temp-store.js');
const C=SupportCore,defaults={pet:'owl',showPet:true,follow:true,paused:false,commandSuggestions:true};
let index,entries,chain=Promise.resolve();
async function library(){if(entries)return;const data=await chrome.storage.local.get(['entries','rocketSnapshot','organizationReplyIds']);entries=data.entries||[];const bundle=await(await fetch(chrome.runtime.getURL('data/rocket-docs.json'))).json();if(data.rocketSnapshot?.version!==bundle.version){const oldIds=new Set(data.rocketSnapshot?.ids||[]),current=new Map(entries.map(e=>[e.id,e]));for(const e of bundle.entries){if(current.get(e.id)?.rocketManaged&&(current.get(e.id).checkedAt||0)<=(e.checkedAt||0)||!current.has(e.id)&&!oldIds.has(e.id))current.set(e.id,{...e,rocketManaged:true});}entries=[...current.values()];await chrome.storage.local.set({entries,rocketSnapshot:{version:bundle.version,ids:[...new Set([...oldIds,...bundle.entries.map(e=>e.id)])]}});}const organization=await(await fetch(chrome.runtime.getURL('data/organization-replies.json'))).json();
 const seeded=new Set(data.organizationReplyIds||[]),next=[...entries];let changed=false;
 for(const raw of organization.entries){if(seeded.has(raw.id))continue;seeded.add(raw.id);changed=true;if(next.some(e=>e.id===raw.id||e.kind==='template'&&e.title===raw.title&&e.body===raw.body))continue;next.push(C.normalize(raw,next));}
 if(changed){await chrome.storage.local.set({entries:next,organizationReplyIds:[...seeded]});entries=next;}
 index=new C.Index(entries);}
async function settings(){return {...defaults,...(await chrome.storage.local.get('settings')).settings};}
async function handle(m,sender){if(sender.id!==chrome.runtime.id)throw Error('Unknown sender.');await library();switch(m.type){
 case 'sourceRefresh':await chrome.alarms.create('rocket-source-manual',{delayInMinutes:0.01});return true;
 case 'sourceStatus':return (await chrome.storage.local.get('sourceSync')).sourceSync||{};
 case 'state':return {entries,settings:await settings(),clipboard:(await chrome.storage.session.get('clipboard')).clipboard||[]};
 case 'tempList':return SupportTemp.list((await chrome.storage.session.get('tempItems')).tempItems||[]);
 case 'tempGet':{const item=((await chrome.storage.session.get('tempItems')).tempItems||[]).find(i=>i.id===m.id);if(!item)throw Error('This item has expired or was removed.');return item;}
 case 'tempAdd':{const old=(await chrome.storage.session.get('tempItems')).tempItems||[];const next=SupportTemp.add(old,m.items);try{await chrome.storage.session.set({tempItems:next});}catch{throw Error('Chrome session storage is full. Remove an item and try again. Existing items were kept.');}return SupportTemp.list(next);}
 case 'tempRemove':{const old=(await chrome.storage.session.get('tempItems')).tempItems||[];await chrome.storage.session.set({tempItems:old.filter(i=>i.id!==m.id)});return true;}
 case 'tempClear':await chrome.storage.session.remove('tempItems');return true;
 case 'config':return {entries:entries.filter(e=>e.alias),settings:await settings()};
 case 'search':return index.search(String(m.query||''),[...C.kinds,'reply'].includes(m.kind)?m.kind:'');
 case 'save':{if(entries.some(e=>e.id===m.entry?.id&&e.officialSource==='terms'))throw Error('The official terms are refreshed from Rocket. Add a separate personal doc instead.');const e=C.normalize(m.entry,entries);const next=[...entries.filter(x=>x.id!==e.id),e];await chrome.storage.local.set({entries:next});entries=next;index.rebuild(entries);return e;}
 case 'delete':{if(entries.some(e=>e.id===m.id&&e.officialSource==='terms'))throw Error('The official terms cannot be removed.');const next=entries.filter(e=>e.id!==m.id);await chrome.storage.local.set({entries:next});entries=next;index.rebuild(entries);return true;}
 case 'capture':if(!(await settings()).paused){const old=(await chrome.storage.session.get('clipboard')).clipboard||[];await chrome.storage.session.set({clipboard:C.capture(old,m.text)});}return true;
 case 'settings':{const next=await settings();for(const key of ['showPet','follow','paused','commandSuggestions'])if(typeof m.settings?.[key]==='boolean')next[key]=m.settings[key];if(Object.hasOwn(OwlPets,m.settings?.pet))next.pet=m.settings.pet;await chrome.storage.local.set({settings:next});return next;}
 case 'import':{if(!Array.isArray(m.entries)||m.entries.length>5000)throw Error('Import up to 5,000 entries.');const next=[...entries];for(const raw of m.entries)if(!raw.id||!next.some(e=>e.id===raw.id))next.push(C.normalize(raw,next));await chrome.storage.local.set({entries:next});entries=next;index.rebuild(entries);return true;}

 case 'openLibrary':await chrome.runtime.openOptionsPage();return true;
 default:throw Error('Unknown action.');
}}
function openPanel(mode,text,tab,windowId){
 if(typeof text!=='string'||text.length>6000)throw Error('Select a customer message under 6,000 characters.');
 const targetWindow=tab?.windowId??windowId;
 if(!Number.isInteger(targetWindow)||targetWindow<0)throw Error('Open Support Owl using its Chrome toolbar icon, then try again.');
 // Call before any await/storage work to retain Chrome's user gesture.
 const opening=chrome.sidePanel.open(tab?.id!=null?{tabId:tab.id}:{windowId:targetWindow});
 return opening.then(()=>chrome.storage.session.set({['panelIntent:'+targetWindow]:{id:crypto.randomUUID(),mode,text}}));
}
chrome.runtime.onMessage.addListener((m,s,r)=>{
 if(s.id!==chrome.runtime.id){r({ok:false,error:'Unknown sender.'});return;}
 if(['writingConfig','writingSettings','writingIgnore','spellingRun','replyPriority','writingCancel','writingRun'].includes(m.type)){r({ok:true,data:{enabled:false,dialect:'en-IN',ignored:[],issues:[]}});return false;}
 if(['openAI','takeAIInput','replyPreferences','saveReplyPreference','deleteReplyPreference'].includes(m.type)){r({ok:false,error:'AI features are disabled.'});return false;}
 if(m.type==='sidePanel'){
  try{openPanel('library',m.text||'',s.tab,m.windowId).then(()=>r({ok:true}),e=>r({ok:false,error:e.message}));}catch(e){r({ok:false,error:e.message});}return true;
 }
 const task=chain.then(()=>handle(m,s));chain=task.catch(()=>{});task.then(data=>r({ok:true,data}),e=>r({ok:false,error:e.message}));return true;
});
chrome.runtime.onInstalled.addListener(async details=>{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});if(details.reason==='install')await chrome.tabs.create({url:chrome.runtime.getURL('library.html')});await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await chrome.contextMenus.removeAll();chrome.contextMenus.create({id:'search',title:'Find in Support Owl',contexts:['selection']});chrome.contextMenus.create({id:'article',title:'Save selection as a doc',contexts:['selection']});});
async function open(tab,message){try{await chrome.tabs.sendMessage(tab,message,{frameId:0});}catch{await chrome.storage.session.set({pending:message});await chrome.runtime.openOptionsPage();}}
chrome.contextMenus.onClicked.addListener((info,tab)=>{if(info.menuItemId==='ai')return;if(tab?.id)open(tab.id,{type:info.menuItemId==='article'?'newArticle':'open',text:info.selectionText,source:info.pageUrl,title:tab.title});});
chrome.commands.onCommand.addListener(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab?.id)open(tab.id,{type:'open'});});
chrome.storage.onChanged.addListener(async(changes,area)=>{if(area==='local'&&changes.entries&&index){entries=changes.entries.newValue||[];index.rebuild(entries);}for(const tab of await chrome.tabs.query({}))if(tab.id)chrome.tabs.sendMessage(tab.id,{type:'stateChanged'}).catch(()=>{});});


if(chrome.alarms){
 const sync=SupportSourceSync.create({storage:chrome.storage.local,alarms:chrome.alarms,sources:SupportSources,commit(kind,incoming){
  const task=chain.then(async()=>{await library();const next=SupportSourceSync.merge(entries,kind,incoming);await chrome.storage.local.set({entries:next});entries=next;index.rebuild(entries);});chain=task.catch(()=>{});return task;
 }});
 chrome.alarms.onAlarm.addListener(a=>sync.onAlarm(a));
 chrome.runtime.onStartup?.addListener(()=>sync.ensure());
 chrome.runtime.onInstalled.addListener(()=>sync.ensure());
 sync.ensure().catch(()=>{});
}
