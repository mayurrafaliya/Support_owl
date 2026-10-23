(()=>{
'use strict';
if(window!==window.top)return;
const E=SupportWritingEditor,rpc=(type,payload={})=>SupportUI.rpc(type,payload);
let pref={enabled:true,dialect:'en-IN',ignored:[]},target=null,host,shadow,panel,heading,body,layer,launcher;
let epoch=0,requestSequence=0,timer,spellTimer,layoutFrame,requestId=null,composing=false,touched=false,marks=[],selected=null,undo=null,settingsOpen=false;
function node(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
function button(text,fn){const b=node('button',text);b.type='button';b.onclick=fn;return b;}
function cancel(){clearTimeout(timer);clearTimeout(spellTimer);epoch++;if(requestId){rpc('writingCancel',{requestId}).catch(()=>{});requestId=null;}}
function close(){if(panel)panel.hidden=true;settingsOpen=false;}
function clear(){marks=[];layer?.replaceChildren();if(launcher)launcher.hidden=true;close();}
function mount(){
 if(host)return;
 host=node('div');host.dataset.supportOwl='writing';host.style.cssText='all:initial;position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none';shadow=host.attachShadow({mode:'closed'});
 const css=node('style');css.textContent=`
 :host{color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}
 button{font:inherit;cursor:pointer;border:0;border-radius:6px;padding:6px 9px;background:transparent;color:#203438}button:hover{background:#edf4f4}button:focus-visible{outline:2px solid #236a59;outline-offset:2px}button:disabled{opacity:.5;cursor:default}
 section{position:fixed;width:min(540px,calc(100vw - 16px));background:#fff;color:#203438;border:1px solid #d8e3e5;border-radius:12px;padding:10px 12px;box-shadow:0 6px 24px #163c2420;font:14px/1.5 system-ui,sans-serif;font-kerning:normal;pointer-events:auto;text-align:left}
 header,.actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}header strong{flex:1}header button{font-size:12px}.body{max-height:min(210px,40vh);overflow:auto;overscroll-behavior:contain}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}.replacement{font-size:15px}.muted,small{color:#536b70;font-size:12px}small{display:block;margin:8px 0}.primary{background:#e4f1eb;color:#236a59;font-weight:600}.actions{margin-top:8px}
 .mark{position:fixed;pointer-events:auto;border:0;border-bottom:2px solid #db3737;border-radius:0;padding:0;height:6px;min-width:3px;background:transparent}.mark:hover{background:#db37371a}.mark.style{border-bottom-color:#397acb}
 .launcher{position:fixed;pointer-events:auto;background:#fff;border:1px solid #d8e3e5;box-shadow:0 2px 8px #163c2415;font:12px/1.4 system-ui,sans-serif}
 `;
 layer=node('div');panel=node('section');panel.hidden=true;panel.setAttribute('aria-label','Writing assistance');
 const header=node('header');heading=node('strong','Writing');const settings=button('Settings',showSettings),dismiss=button('×',close);dismiss.setAttribute('aria-label','Close writing suggestions');header.append(heading,settings,dismiss);body=node('div');body.className='body';panel.append(header,body);
 launcher=button('Writing',()=>showTools());launcher.className='launcher';launcher.hidden=true;launcher.setAttribute('aria-label','Writing tools and settings');
 shadow.append(css,layer,launcher,panel);shadow.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});document.documentElement.append(host);
}
function anchor(){const snap=target&&E.read(target);if(!snap)return null;try{if(snap.selectionRange)return snap.selectionRange.getClientRects()[0]||target.getBoundingClientRect();}catch{}return SupportWritingGeometry.rects(target,...snap.selection)[0]||target.getBoundingClientRect();}
function position(rect){if(!target||!host)return;const a=rect||anchor();if(!a)return;const width=panel.getBoundingClientRect().width,height=panel.getBoundingClientRect().height;panel.style.left=Math.max(8,Math.min(a.left,innerWidth-width-8))+'px';panel.style.top=Math.max(8,Math.min(a.bottom+height+6<innerHeight?a.bottom+6:a.top-height-6,innerHeight-height-8))+'px';launcher.style.left=Math.max(8,Math.min(a.right||a.left,innerWidth-85))+'px';launcher.style.top=Math.max(8,Math.min(a.bottom+6,innerHeight-40))+'px';}
function paint(){
 layer?.replaceChildren();if(!target)return;const snap=E.read(target);if(!snap)return;
 marks=marks.filter(m=>m.snap.text===snap.text);
 for(const m of marks){if(snap.rich)m.range=E.range(snap,m.start,m.end);m.rects=SupportWritingGeometry.rects(target,m.start,m.end,m.range);for(const r of m.rects){const line=button('',()=>showMark(m,r));line.className='mark'+(m.kind==='style'?' style':'');line.setAttribute('aria-label','Suggestion for '+m.original);Object.assign(line.style,{left:r.left+'px',top:(r.bottom-3)+'px',width:r.width+'px'});layer.append(line);}}
 position();
}
function queueLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=null;paint();});}
function show(title){mount();heading.textContent=title;body.replaceChildren();panel.hidden=false;settingsOpen=false;}
function message(text){body.append(node('p',text));position();}
function showSettings(){show('Writing settings');settingsOpen=true;body.append(node('p','English (India)'),node('small','British spelling with Indian English usage. All checking stays on this device.'));
 const toggle=button(pref.enabled?'Disable on this site':'Enable on this site',async()=>{toggle.disabled=true;try{pref=await rpc('writingSettings',{enabled:!pref.enabled});cancel();clear();showSettings();}catch(e){message(e.message);toggle.disabled=false;}});body.append(toggle,node('small','Remembered for '+location.hostname),node('small','Ignored words are remembered across tabs for this browser session only.'));position();}
function showTools(){show(pref.enabled?'Writing tools':'Writing is off for this site');if(pref.enabled){const actions=node('div');actions.className='actions';for(const [mode,label]of [['check','Check grammar'],['concise','Make concise'],['rephrase','Rephrase']])actions.append(button(label,()=>run(mode,true)));body.append(actions);if(undo)body.append(button('Undo last change',()=>{try{const u=undo;if(!u||u.target!==target||E.read(target)?.text!==u.after)throw Error('The text changed. Use the editor’s undo instead.');E.apply(target,E.read(target),u.start,u.start+u.replacement.length,u.original);undo=null;schedule();}catch(e){message(e.message);}}));}else body.append(button('Enable on this site',showSettings));position();}
function showMark(m,rect){
 if(m.epoch!==epoch||E.read(target)?.text!==m.snap.text)return;
 show(m.kind==='spelling'?'Spelling':m.kind==='style'?'Wording alternative':'Grammar');body.append(node('small',m.reason));const text=node('p',m.replacement);text.className='replacement';body.append(text);
 const actions=node('div');actions.className='actions';const apply=button('Apply',()=>{try{if(m.epoch!==epoch)throw Error('The text changed. Check it again.');const el=target;E.apply(el,m.snap,m.start,m.end,m.replacement);undo=m.snap.rich?null:{target:el,after:E.read(el).text,start:m.start,replacement:m.replacement,original:m.original};cancel();clear();touched=true;schedule();}catch(e){message(e.message);}});apply.className='primary';apply.disabled=m.snap.rich&&!m.range;actions.append(apply,button('Copy',async()=>{try{await navigator.clipboard.writeText(m.replacement);heading.textContent='Copied';}catch{message('Select the suggestion and copy it manually.');}}),button('Dismiss',()=>{marks=marks.filter(x=>x!==m);close();paint();}));
 if(m.kind==='spelling')actions.append(button('Ignore word',async()=>{try{pref=await rpc('writingIgnore',{word:m.original});marks=marks.filter(x=>x.original.toLowerCase()!==m.original.toLowerCase());close();paint();}catch(e){message(e.message);}}));
 body.append(actions);
 if(m.alternatives?.length>1){const options=node('div');options.className='actions';for(const alternative of m.alternatives.slice(1))options.append(button(alternative,()=>{m.replacement=alternative;showMark(m,rect);}));body.append(options);}
 if(apply.disabled)body.append(node('small','This passage crosses formatting that cannot be safely replaced. Use Copy.'));
 position(rect);
}
function addEdits(edits,snap,start,ticket,kind){for(const edit of edits){const a=start+edit.start,b=start+edit.end;if(snap.text.slice(a,b)!==edit.original||marks.some(m=>a<m.end&&b>m.start))continue;marks.push({...edit,kind:kind||edit.kind||'grammar',start:a,end:b,snap,epoch:ticket,range:snap.rich?E.range(snap,a,b):null});}paint();}
function schedule(){
 clearTimeout(timer);clearTimeout(spellTimer);close();if(launcher)launcher.hidden=true;
 const snap=target&&E.read(target);if(!pref.enabled||!touched||composing||document.hidden||!snap?.text.trim())return;
 const ticket=epoch,el=target;
 spellTimer=setTimeout(async()=>{try{const result=await rpc('spellingRun',{text:snap.text});if(ticket===epoch&&el===target&&E.read(el)?.text===snap.text)addEdits(result.edits,snap,0,ticket,'spelling');}catch{/* No popup while typing. */}},100);
 timer=setTimeout(()=>{if(ticket===epoch){launcher.hidden=false;position();run('check',false);}},1500);
}
async function run(mode,explicit=false){
 if(explicit)clearTimeout(timer);
 if(!target||!pref.enabled||composing)return;
 if(requestId)rpc('writingCancel',{requestId}).catch(()=>{});
 const ticket=epoch,el=target,snap=E.read(el);if(!snap)return;
 let start=0,end=snap.text.length;
 if(mode!=='check'){const chosen=selected?.target===el&&selected.text===snap.text?selected:snap;if(chosen.selection[1]>chosen.selection[0]){[start,end]=chosen.selection;}}
 const text=snap.text.slice(start,end);if(!text.trim())return;
 if(mode!=='check'&&snap.selectionText&&snap.selection[0]===snap.selection[1]){show('Select your draft');message('Select text inside the current draft, outside quoted messages and signatures.');return;}
 if(explicit){show(mode==='check'?'Checking grammar…':'Rewriting…');message('Processing locally. You can keep typing to cancel.');}
 if(text.length>20000){if(explicit)message('Use a draft of up to 20,000 characters. Nothing has been sent or truncated.');return;}
 const id=String(++requestSequence);requestId=id;
 try{const result=await rpc('writingRun',{mode,text,context:mode==='check'?undefined:snap.text,requestId:id});if(ticket!==epoch||target!==el||requestId!==id||E.read(el)?.text!==snap.text)return;
  if(result.deferred){if(explicit)message('Reply generation has priority. Try again when it finishes.');else timer=setTimeout(()=>{if(ticket===epoch)run('check',false);},3000);return;}
  if(mode==='check')marks=marks.filter(m=>m.kind==='spelling');else marks=marks.filter(m=>m.end<=start||m.start>=end);
  const edits=mode==='check'?result.edits:[{start:0,end:text.length,original:text,replacement:result.text,reason:'Same meaning, different wording.'}];
  addEdits(edits,snap,start,ticket,mode==='check'?'grammar':'style');
  if(explicit){const mark=marks.find(m=>mode==='check'?m.kind==='grammar':m.kind==='style');if(mark)showMark(mark);else{show('No suggestions');message('No clear grammar errors found.');}}
 }catch(e){if(explicit&&ticket===epoch&&requestId===id)message(e.message||'The local check stopped.');}
 finally{if(requestId===id)requestId=null;}
}
document.addEventListener('focusin',e=>{if(e.target.closest?.('[data-support-owl]'))return;const next=E.eligible(e.target);if(next===target)return;cancel();clear();target=next;touched=false;selected=null;undo=null;if(target)mount();},true);
document.addEventListener('input',e=>{if(target&&(e.target===target||target.contains(e.target))){cancel();clear();undo=null;selected=null;touched=true;schedule();}},true);
function selectionChanged(){if(!target||document.activeElement===host)return;const snap=E.read(target);if(!snap)return;if(snap.selection[1]>snap.selection[0]){selected={...snap,target};mount();launcher.hidden=false;position();}else selected=null;}
document.addEventListener('selectionchange',selectionChanged);document.addEventListener('select',selectionChanged,true);
document.addEventListener('pointerup',e=>{if(!target||!(e.target===target||target.contains(e.target)))return;selectionChanged();const m=marks.find(m=>m.rects?.some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom));if(m)showMark(m);else close();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();if(launcher)launcher.hidden=true;}},true);
document.addEventListener('compositionstart',()=>{composing=true;cancel();clear();},true);document.addEventListener('compositionend',()=>{composing=false;schedule();},true);
window.addEventListener('scroll',queueLayout,true);window.addEventListener('resize',queueLayout);
const observer=new ResizeObserver(queueLayout);document.addEventListener('focusin',()=>{observer.disconnect();if(target)observer.observe(target);},true);
document.addEventListener('visibilitychange',()=>{cancel();close();if(!document.hidden)schedule();});window.addEventListener('pagehide',()=>{cancel();clear();target=null;});
SupportUI.onDisconnect(()=>{cancel();observer.disconnect();cancelAnimationFrame(layoutFrame);host?.remove();target=null;});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='stateChanged')rpc('writingConfig').then(p=>{if(p.enabled!==pref.enabled||JSON.stringify(p.ignored)!==JSON.stringify(pref.ignored)){pref=p;cancel();clear();schedule();}}).catch(()=>{});});
rpc('writingConfig').then(p=>{pref=p;target=E.eligible(document.activeElement);if(target)mount();}).catch(()=>{});
})();
