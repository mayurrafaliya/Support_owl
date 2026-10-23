(function(root){
'use strict';
const fileLimit=2*1024*1024;
function bytes(size){return size>=1024*1024?(size/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(size/1024))+' KB';}
function mount({main,el,button,rpc,copy,status,getClipboard,onReact}){
 let disposed=false,request=0,busy=false;const handlers=[];const onMain=(type,fn)=>{main.addEventListener(type,fn);handlers.push([type,fn]);};const urls=new Map(),loaded=new Map();
 const title=el('h2',{},'Temporary store');
 const note=el('small',{},'Shared across your sites · Cleared when Chrome restarts or this extension reloads.');
 const drop=el('div',{class:'drop-zone',tabindex:'0','aria-label':'Drop files, screenshots, or text here. Paste a screenshot here with Command or Control V.'},el('strong',{},'Drop files, screenshots, or text here'),el('small',{},'Or paste a screenshot here · Up to 2 MB per file'));
 const picker=el('input',{type:'file',multiple:'',class:'hidden','aria-label':'Choose temporary files'});
 const text=el('textarea',{rows:'2',maxlength:100000,placeholder:'Write or paste a temporary note…','aria-label':'Temporary text'});
 const saveText=button('Save text',async()=>{if(!text.value.trim())throw Error('Write or paste some text first.');await add([{kind:'text',text:text.value}]);text.value='';});
 const usage=el('small',{role:'status'}),files=el('div',{class:'results'}),clipboard=el('ul',{class:'clip'});
 main.replaceChildren(title,note,drop,picker,el('div',{class:'row wrap'},button('Add files',()=>picker.click()),button('Clear saved items',()=>{
  const confirm=el('div',{class:'card'},el('p',{},'Remove all manually saved items? Download anything you need first.'),button('Cancel',()=>confirm.remove()),button('Clear saved items now',async()=>{await rpc('tempClear');confirm.remove();await refresh();}));main.append(confirm);
 })),text,saveText,usage,files,el('h3',{},'Recent copies'),clipboard);
 function error(e){if(!disposed)status(e.message,true);}
 function fileToRaw(file){if(file.size>fileLimit)throw Error('“'+file.name+'” exceeds 2 MB. Choose a smaller file.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({kind:'file',name:file.name||'Screenshot.png',mime:file.type||'application/octet-stream',data:String(reader.result).split(',')[1]||''});reader.onerror=()=>reject(Error('Unable to read '+file.name));reader.readAsDataURL(file);});}
 async function upload(fileList){const selected=Array.from(fileList);if(!selected.length)return;if(selected.length>40)throw Error('Choose up to 40 files.');if(selected.reduce((n,f)=>n+f.size,0)>3*1024*1024)throw Error('These files exceed the session capacity. Add a smaller selection.');const items=await Promise.all(selected.map(fileToRaw));await add(items);}
 async function add(items){if(busy)throw Error('Wait for the current upload to finish.');busy=true;saveText.disabled=true;try{await rpc('tempAdd',{items});await refresh();status('Saved for this Chrome session. Available from your other sites.');onReact?.('happy');}finally{busy=false;saveText.disabled=false;}}
 picker.addEventListener('change',()=>{upload(picker.files).catch(error).finally(()=>picker.value='');});
 onMain('dragover',event=>{event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';drop.setAttribute('data-over','true');});
 onMain('dragleave',()=>drop.setAttribute('data-over','false'));
 onMain('drop',event=>{event.preventDefault();event.stopPropagation();drop.setAttribute('data-over','false');const transfer=event.dataTransfer;if(!transfer)return;const task=transfer.files?.length?upload(transfer.files):transfer.getData('text/plain').trim()?add([{kind:'text',text:transfer.getData('text/plain')}]):Promise.reject(Error('Drop a file or plain text here.'));task.catch(error);});
 onMain('paste',event=>{const data=event.clipboardData;if(!data)return;const pasted=Array.from(data.items||[]).filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);if(pasted.length){event.preventDefault();event.stopPropagation();upload(pasted).catch(error);}else if(event.target===drop){const value=data.getData('text/plain');if(value.trim()){event.preventDefault();event.stopPropagation();add([{kind:'text',text:value}]).catch(error);}}});
 function blob(item){const raw=atob(item.data);const array=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)array[i]=raw.charCodeAt(i);return new Blob([array],{type:item.mime});}
 async function get(id){if(loaded.has(id))return loaded.get(id);const item=await rpc('tempGet',{id});if(disposed)return null;loaded.set(id,item);return item;}
 function url(item){if(!urls.has(item.id))urls.set(item.id,URL.createObjectURL(blob(item)));return urls.get(item.id);}
 async function download(id){const item=await get(id);if(!item)return;const a=el('a',{href:url(item),download:item.name});main.append(a);a.click();a.remove();status('Download requested.');}
 async function copyImage(id){
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Image copying is unavailable on this page. Use Download, or open the docked side panel.');
  const promised=(async()=>{const item=await get(id);if(!item)throw Error('Store closed.');const source=blob(item);if(item.mime==='image/png')return source;const bitmap=await createImageBitmap(source);try{if(bitmap.width*bitmap.height>16000000)throw Error('Image is too large to copy. Use Download.');const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image conversion failed.')),'image/png'));}finally{bitmap.close();}})();
  try{await navigator.clipboard.write([new ClipboardItem({'image/png':promised})]);status('Image copied. Paste it into a supported editor on another site.');onReact?.('happy');}catch(e){await promised.catch(()=>{});throw Error(e.message+' Use Download if the site blocks image copying.');}
 }
 async function refresh(){
  const ticket=++request;const data=await rpc('tempList');if(disposed||ticket!==request)return;
  const ids=new Set(data.items.map(i=>i.id));for(const [id,address]of urls)if(!ids.has(id)){URL.revokeObjectURL(address);urls.delete(id);loaded.delete(id);}
  files.replaceChildren();usage.textContent=data.items.length+' saved · '+Math.round(data.used/data.limit*100)+'% of temporary capacity';
  for(const item of data.items){
   const card=el('article',{class:'card temp-card'});const row=el('div',{class:'row wrap actions'});
   if(item.kind==='text'){card.append(el('p',{class:'detail'},item.text));row.append(button('Copy',()=>copy(item.text)));}
   else{card.append(el('h3',{class:'file-name'},item.name),el('small',{},bytes(item.size)));row.append(button('Download',()=>download(item.id)));
    if(/^image\/(png|jpeg|webp|gif)$/.test(item.mime)){
     const img=el('img',{class:'temp-preview',alt:item.name,loading:'lazy'});card.append(img);row.prepend(button('Copy image',()=>copyImage(item.id)));
     get(item.id).then(full=>{if(full&&!disposed&&request===ticket)img.src=url(full);}).catch(error);
    }
   }
   row.append(button('Remove',async()=>{await rpc('tempRemove',{id:item.id});await refresh();}));card.append(row);files.append(card);
  }
  if(!data.items.length)files.append(el('small',{},'Your saved items will appear here.'));
  clipboard.replaceChildren();for(const item of getClipboard())clipboard.append(el('li',{},el('p',{},item.text),button('Copy',()=>copy(item.text))));
  if(!getClipboard().length)clipboard.append(el('li',{},'Copied text will appear here.'));
 }
 refresh().catch(error);
 return {refresh,dispose(){disposed=true;request++;for(const [type,fn]of handlers)main.removeEventListener(type,fn);for(const address of urls.values())URL.revokeObjectURL(address);urls.clear();loaded.clear();}};
}
root.SupportStoreUI={mount};
})(globalThis);
