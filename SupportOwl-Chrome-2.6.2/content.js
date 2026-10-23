(()=>{
'use strict';if(globalThis.__supportOwl)return;globalThis.__supportOwl=true;
let data={entries:[],settings:{}},pet,petButton,panel,ui,opened=false,selected='',activation='',mouse={x:innerWidth-70,y:innerHeight-70};
let selectionTimer, moodTimer, animationFrame=0, frozen=false, renderedPet='', currentPosition={x:innerWidth-62,y:innerHeight-62};
let petObserver,configTimer,configAttempts=0;
const petDefaults={pet:'owl',showPet:true,follow:true,paused:false,commandSuggestions:true};
function acceptState(state){data={...data,...state,settings:{...petDefaults,...data.settings,...state?.settings}};update();}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function react(mood){if(!petButton||SupportUI.isDisconnected())return;clearTimeout(moodTimer);petButton.setAttribute('data-mood',mood);moodTimer=setTimeout(()=>petButton?.setAttribute('data-mood','idle'),mood==='thinking'?1100:850);}
function excluded(t){return t instanceof Element&&t.closest('[data-support-owl],input[type=password],input[autocomplete*=password],input[autocomplete=one-time-code]');}
function selection(){const t=document.activeElement;if(excluded(t))return '';if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement)return typeof t.selectionStart==='number'?t.value.slice(t.selectionStart,t.selectionEnd):'';return window.getSelection()?.toString()||'';}
document.addEventListener('copy',e=>{if(e.isTrusted&&!excluded(e.target)&&!data.settings.paused&&!SupportUI.isDisconnected()){const text=e.clipboardData?.getData('text/plain')||selection();if(text)SupportUI.rpc('capture',{text}).then(()=>react('happy')).catch(()=>{});}});
function queueSelectionSearch(e){
 if(excluded(e.target)||excluded(document.activeElement))return;
 clearTimeout(selectionTimer);
 selectionTimer=setTimeout(()=>{
  if(!opened||!ui||data.settings.paused||SupportUI.isDisconnected()||excluded(document.activeElement))return;
  const text=selection().trim();
  if(text)ui.searchSelection(text).catch(ui.showError);
 },150);
}
for(const type of ['selectionchange','mouseup','keyup','select'])document.addEventListener(type,queueSelectionSearch);

SupportCommands.install(()=>data);
function update(){if(!pet)return;if(!pet.isConnected&&document.documentElement&&!SupportUI.isDisconnected())document.documentElement.append(pet);pet.style.display=data.settings.showPet?'block':'none';const key=Object.hasOwn(OwlPets,data.settings.pet)?data.settings.pet:'owl';if(key!==renderedPet){petButton.innerHTML=OwlPets[key].svg;renderedPet=key;react('greet');}position();}
function position(){
 if(!pet||animationFrame||document.hidden||!data.settings.showPet)return;
 animationFrame=requestAnimationFrame(move);
}
function move(){
 animationFrame=0;if(!pet||document.hidden||!data.settings.showPet||SupportUI.isDisconnected()||frozen&&!opened)return;
 const dock=opened||!data.settings.follow;
 const x=Math.max(4,Math.min(dock?innerWidth-62:mouse.x+25,innerWidth-40));
 const y=Math.max(4,Math.min(dock?innerHeight-62:mouse.y+20,innerHeight-43));
 const factor=reducedMotion.matches?1:.22;
 currentPosition.x+=(x-currentPosition.x)*factor;currentPosition.y+=(y-currentPosition.y)*factor;
 pet.style.left=currentPosition.x+'px';pet.style.top=currentPosition.y+'px';
 if(Math.abs(x-currentPosition.x)+Math.abs(y-currentPosition.y)>.6)position();
}
function close(){clearTimeout(selectionTimer);if(panel)panel.style.display='none';opened=false;position();}
async function open(text,article){if(!panel){panel=document.createElement('div');panel.setAttribute('data-support-owl','panel');panel.style.cssText='all:initial;position:fixed;right:12px;bottom:64px;width:min(420px,calc(100vw - 24px));height:min(480px,calc(100vh - 84px));z-index:2147483647;box-shadow:0 12px 45px #0005';document.documentElement.append(panel);ui=SupportUI.mount(panel,{close,onReact:react,onState:acceptState});}panel.style.display='block';opened=true;position();await ui.ready;await ui.refresh();if(article)await ui.newArticle(article);else await ui.open(text);}
function createPet(){if(window!==window.top||pet)return;pet=document.createElement('div');pet.setAttribute('data-support-owl','pet');pet.style.cssText='all:initial;position:fixed;width:34px;height:37px;z-index:2147483646';const shadow=pet.attachShadow({mode:'closed'});const style=document.createElement('style');style.textContent='button{all:unset;display:block;width:34px;height:37px;cursor:pointer;filter:drop-shadow(0 2px 3px #0004)}button:focus-visible{outline:2px solid #82b990;border-radius:8px}svg{width:100%;height:100%;overflow:visible}'+OwlPetMotion.css;petButton=document.createElement('button');petButton.type='button';petButton.setAttribute('aria-label','Open Support Owl');petButton.addEventListener('pointerenter',()=>{activation=selection();frozen=true;react('curious');});petButton.addEventListener('pointerleave',()=>{frozen=false;position();});petButton.addEventListener('pointerdown',e=>{e.preventDefault();activation=selection()||activation;});petButton.addEventListener('click',()=>{react('greet');const text=activation||selection();activation='';if(text.trim())open(text).catch(()=>{});else if(opened)close();else open('').catch(()=>{});});shadow.append(style,petButton);document.documentElement.append(pet);update();if(typeof MutationObserver==='function'){petObserver=new MutationObserver(()=>{if(pet&&!pet.isConnected&&!SupportUI.isDisconnected())update();});petObserver.observe(document,{childList:true,subtree:true});}window.addEventListener('pointermove',e=>{const r=pet.getBoundingClientRect();frozen=e.clientX>=r.left-18&&e.clientX<=r.right+18&&e.clientY>=r.top-18&&e.clientY<=r.bottom+18;if(frozen)return;mouse={x:e.clientX,y:e.clientY};position();},{passive:true});window.addEventListener('resize',position);}
chrome.runtime.onMessage.addListener((m,s,r)=>{if(s.id!==chrome.runtime.id)return;if(m.type==='stateChanged')SupportUI.rpc('config').then(state=>{acceptState(state);if(ui&&opened)ui.refresh().catch(ui.showError);}).catch(()=>{});else if(m.type==='open'||m.type==='newArticle'){open(m.text||selection(),m.type==='newArticle'?m:null).catch(()=>{});r({ok:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;}else position();});
SupportUI.onDisconnect(()=>{petObserver?.disconnect();clearTimeout(configTimer);petButton?.setAttribute('title','Support Owl was updated. Save your work and refresh this page.');clearTimeout(selectionTimer);clearTimeout(moodTimer);if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;});
function loadConfig(){
 configAttempts++;
 SupportUI.rpc('config').then(s=>{acceptState(s);createPet();}).catch(()=>{
  if(configAttempts<3&&!SupportUI.isDisconnected())configTimer=setTimeout(loadConfig,500*configAttempts);
 });
}
loadConfig();
})();
