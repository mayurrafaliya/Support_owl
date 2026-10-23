'use strict';
const $=id=>document.getElementById(id),origins=['http://127.0.0.1/*'];
let ready=false,active=null,epoch=0,pendingSelection='',revision=null,accepting=false;
const fields=['customer','rough','intent'];
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function controls(){const busy=!!active;$('check').disabled=busy;$('retry-review').disabled=busy||!ready;$('add-context').disabled=busy;$('generate').disabled=busy||!ready||!$('customer').value.trim();$('model').disabled=busy;$('stop').hidden=!busy;$('copy').disabled=busy||!$('draft').value.trim();$('draft').readOnly=busy;$('feedback').disabled=busy;$('revise').disabled=busy||!ready||!$('draft').value.trim()||!$('feedback').value.trim();$('accept').disabled=busy||accepting||!revision;$('remember').disabled=busy||accepting;$('preference').disabled=busy||accepting||!$('remember').checked;}
async function rpc(type,payload={}){const r=await chrome.runtime.sendMessage({type,...payload});if(!r?.ok)throw Error(r?.error||'Reopen Support Owl after updating the extension.');return r.data;}
function clearOutput(){revision=null;$('review-problems').hidden=true;$('review-issues').replaceChildren();$('feedback-section').hidden=true;$('acceptance').hidden=true;$('feedback').value='';$('preference').value='';$('draft').value='';$('references').hidden=true;$('references').open=false;$('sources').replaceChildren();$('agent-notes').replaceChildren();$('conflicts').replaceChildren();$('conflicts').hidden=true;}
function invalidate(reason='edited'){epoch++;if(active){active.controller.abort(reason);clearTimeout(active.timeout);clearTimeout(active.progress);active=null;}controls();}
function showNotes(notes){$('agent-notes').replaceChildren();for(const text of [...new Set(notes)]){const item=document.createElement('li');item.textContent=text;$('agent-notes').append(item);}$('agent-notes-section').hidden=!notes.length;}
async function run(task,reply=false){
 if(active)return;
 const job={id:++epoch,controller:new AbortController(),stage:'Preparing your case'};active=job;
 const current=()=>active===job&&epoch===job.id&&!job.controller.signal.aborted;
 job.timeout=setTimeout(()=>{if(current()){invalidate('timeout');status('This took too long. No draft was released. Try a shorter conversation or check Ollama.',true);}},reply?180000:20000);
 if(reply)job.progress=setTimeout(()=>{if(current())status(job.stage+'…');job.showProgress=true;},5000);
 controls();
 try{
  await task(job.controller.signal,current,stage=>{job.stage=stage;if(current()&&job.showProgress)status(stage+'…');});
 }catch(e){if(current()){if(['ORIGIN_BLOCKED','OLLAMA_UNREACHABLE','LOCAL_CONNECTION_SETUP'].includes(e.code)){ready=false;$('setup').open=true;$('connection-help').open=true;}if(e.reviewIssues?.length){showNotes(e.reviewIssues);$('references').hidden=false;$('references').open=true;$('review-issues').replaceChildren();for(const text of [...new Set(e.reviewIssues)]){const li=document.createElement('li');li.textContent=text;$('review-issues').append(li);}$('review-problems').hidden=false;$('review-problems').focus();}status(e.message,true);}}
 finally{clearTimeout(job.timeout);clearTimeout(job.progress);if(active===job){active=null;controls();}}
}
function applyModels(result){const previous=$('model').value;$('model').replaceChildren();for(const name of result.models){const option=document.createElement('option');option.value=name;option.textContent=name;$('model').append(option);}$('model').value=result.models.includes(previous)?previous:result.models.includes('gemma4:e4b')?'gemma4:e4b':result.models[0]||'';ready=!!$('model').value;if(ready)$('setup').open=false;status(ready?'Connected. Add the customer conversation to generate a reply.':'No installed local models found. Choose a model in Ollama, then check again.');}
$('origin').textContent=location.origin+' · Support Owl '+chrome.runtime.getManifest().version;
$('model').onchange=()=>{invalidate();clearOutput();controls();};
$('check').onclick=async()=>{try{if(!await chrome.permissions.request({origins}))return status('Local connection permission was not granted.',true);await run(async(signal,current)=>{status('Checking Ollama…');ready=false;const result=await SupportOllama.check(signal);if(current())applyModels(result);});}catch(e){status(e.message,true);}};
for(const id of fields)$(id).addEventListener('input',()=>{const wasBusy=!!active;invalidate();clearOutput();controls();if(wasBusy)status('Inputs changed. Generate again when ready.');});
function generateReply(feedback='',previousDraft='',priorReviewIssues=[]){
 let input;try{input=SupportComposer.inputs(Object.fromEntries(fields.map(id=>[id,$(id).value])));}catch(e){status(e.message,true);return;}
 clearOutput();status('Preparing your reply…');
 return run(async(signal,current,stage)=>{
  const {entries}=await rpc('state');if(!current())return;
  const preferences=await rpc('replyPreferences');if(!current())return;
  if(!globalThis.SupportPlaybookData||!globalThis.SupportPlaybook)throw Error('The approved support playbook could not load. Reload Support Owl and reopen this panel.');
  const context={...SupportComposer.prepare(input,entries),feedback,previousDraft,preferences,priorReviewIssues};
  $('references').hidden=false;$('team-guidance').textContent='Rocket terms govern contractual policy; Docs explain product behaviour. The approved support playbook guides the workflow. Your rough draft supplies case facts and completed actions.';
  $('sources-section').hidden=!context.sources.length;
  for(const source of context.sources){const card=document.createElement('div');card.className='source';const title=document.createElement(source.url?'a':'strong');title.textContent=source.title+' — '+source.heading;if(source.url){title.href=source.url;title.target='_blank';title.rel='noopener noreferrer';}const excerpt=document.createElement('p');excerpt.textContent=source.text;card.append(title,excerpt);$('sources').append(card);}
  const result=await SupportComposer.generate(context,signal,$('model').value,stage);if(!current())return;
  showNotes(result.notes||[]);
  if(result.blocked){$('conflicts').hidden=false;for(const conflict of result.conflicts){const p=document.createElement('p');p.textContent=conflict.reason+' Docs: “'+conflict.docQuote+'”';const b=document.createElement('button');b.textContent='Review “'+conflict.quote+'”';b.onclick=()=>{const start=$('rough').value.indexOf(conflict.quote);if(start>=0){$('rough').focus();$('rough').setSelectionRange(start,start+conflict.quote.length);}};$('conflicts').append(p,b);}status('Your rough draft conflicts with Docs. Correct the highlighted passage before generating.',true);return;}
  $('draft').value=result.text;$('feedback-section').hidden=false;
  if(feedback){revision={text:result.text,epoch};$('acceptance').hidden=false;$('preference').value=result.preference||'';$('remember').checked=!!result.preference;status('Revision ready. Review it, then accept to save your preference.');}
  else status('Draft ready. Review before copying.');
 },true);
};
$('generate').onclick=()=>generateReply();
$('retry-review').onclick=()=>generateReply('','',[...$('review-issues').children].map(li=>li.textContent));
$('add-context').onclick=()=>{$('rough').focus();};
$('feedback').oninput=controls;
$('remember').onchange=controls;
$('revise').onclick=()=>{const feedback=$('feedback').value.trim(),previous=$('draft').value;if(!feedback||!previous.trim())return;return generateReply(feedback,previous);};
$('accept').onclick=async()=>{
 if(!revision||active||accepting)return;const target=revision;
 if($('draft').value!==target.text){revision=null;$('acceptance').hidden=true;controls();status('Your reply changed. Revise it again before saving a learned preference.');return;}
 accepting=true;controls();
 try{if($('remember').checked)await rpc('saveReplyPreference',{preference:{text:$('preference').value}});if(revision!==target||epoch!==target.epoch)return;revision=null;$('acceptance').hidden=true;status($('remember').checked?'Revision accepted. Writing preference saved on this device.':'Revision accepted. No preference saved.');}
 catch(e){if(revision===target)status(e.message,true);}finally{accepting=false;controls();}
};
$('stop').onclick=()=>{invalidate('user');status('Stopped. You can generate again.');};
$('draft').oninput=()=>{if(revision){revision=null;$('acceptance').hidden=true;}controls();};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('draft').value);status('Reply copied.');rpc('capture',{text:$('draft').value}).catch(()=>{});}catch{status('Copy was blocked. Select the reply and copy it manually.',true);}};
window.addEventListener('pagehide',()=>invalidate('closed'));
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='supportOwlSelection'||typeof event.data.text!=='string'||event.data.text.length>24000)return;const text=event.data.text.trim();if(!text||text===$('customer').value)return;pendingSelection=text;$('selection-notice').hidden=false;});
$('use-selection').onclick=()=>{invalidate();clearOutput();$('customer').value=pendingSelection;pendingSelection='';$('selection-notice').hidden=true;controls();status('Selected text loaded. You can generate a reply now.');};
(async()=>{const token=new URL(location.href).searchParams.get('request');if(token&&/^[a-z0-9-]{1,80}$/i.test(token)){$('customer').value=await rpc('takeAIInput',{token})||'';history.replaceState(null,'',location.pathname);}controls();if(await chrome.permissions.contains({origins}))await run(async(signal,current)=>{const result=await SupportOllama.check(signal);if(current())applyModels(result);});})().catch(e=>status(e.message,true));
