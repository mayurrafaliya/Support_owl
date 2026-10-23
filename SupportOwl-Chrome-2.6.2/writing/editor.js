(function(root){
'use strict';
const excluded='blockquote,.gmail_quote,.gmail_quote_container,.gmail_signature,[data-smartmail="gmail_signature"],[contenteditable="false"],script,style,pre,code';
function eligible(el){
 if(!(el instanceof Element)||el.closest('[data-support-owl],[role="search"],[role="searchbox"],.monaco-editor,.cm-editor,[role="code"],'+excluded))return null;
 if(!(el instanceof HTMLTextAreaElement)&&!el.isContentEditable)return null;
 while(el.parentElement?.isContentEditable)el=el.parentElement;
 const attrs=['id','name','autocomplete','aria-label','placeholder','role'].map(k=>el.getAttribute(k)||'').join(' ');
 if(el.readOnly||el.disabled||el.closest('[hidden],[aria-hidden="true"]')||/search|e-?mail address|postal|street.address|password|passcode|one.time|otp|secret|token|api.?key|credit.?card|cc-number|cc-csc/i.test(attrs))return null;
 return el;
}
function read(el){
 if(!eligible(el)||!el.isConnected)return null;
 if(el instanceof HTMLTextAreaElement)return {text:el.value,rich:false,selection:[el.selectionStart||0,el.selectionEnd||0]};
 let text='';const segments=[];
 const newline=()=>{if(text&&!text.endsWith('\n'))text+='\n';};
 function walk(n){
  if(n.nodeType===3){segments.push({node:n,start:text.length,end:text.length+n.data.length});text+=n.data;return;}
  if(n.nodeType!==1||n.matches(excluded))return;
  if(n.tagName==='BR'){newline();return;}
  const block=/^(DIV|P|LI|UL|OL|SECTION|H[1-6])$/.test(n.tagName);if(block)newline();
  for(const child of n.childNodes)walk(child);if(block)newline();
 }
 for(const child of el.childNodes)walk(child);
 if(text.endsWith('\n'))text=text.slice(0,-1);
 const selection=[0,0],sel=getSelection();let selectionRange=null,selectionText='';
 if(sel?.rangeCount&&el.contains(sel.anchorNode)&&el.contains(sel.focusNode)){
  const r=sel.getRangeAt(0);selectionRange=r.cloneRange();selectionText=r.toString();
  const a=segments.find(s=>s.node===r.startContainer),b=segments.find(s=>s.node===r.endContainer);
  if(a&&b){selection[0]=a.start+r.startOffset;selection[1]=b.start+r.endOffset;}
  else if(!r.collapsed){const start=text.indexOf(selectionText);if(start>=0&&text.indexOf(selectionText,start+1)<0){selection[0]=start;selection[1]=start+selectionText.length;}}
 }
 return {text,rich:true,segments,selection,selectionRange,selectionText};
}
function range(snap,start,end){
 if(!snap.rich)return null;
 const a=snap.segments.find(s=>start>=s.start&&start<s.end),b=[...snap.segments].reverse().find(s=>end>s.start&&end<=s.end);
 if(!a||!b)return null;
 const r=document.createRange();r.setStart(a.node,start-a.start);r.setEnd(b.node,end-b.start);
 if(r.cloneContents().querySelector(excluded+',img,iframe,table'))return null;
 // Block separators in our projection are newlines; DOM Range text omits them.
 if(r.toString().replace(/\s/g,'')!==snap.text.slice(start,end).replace(/\s/g,''))return null;
 return r;
}
function apply(el,snap,start,end,replacement){
 const current=read(el);if(current?.text!==snap.text)throw Error('The text changed. Check it again before applying.');
 el.focus();
 if(!snap.rich){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,snap.text.slice(0,start)+replacement+snap.text.slice(end));el.setSelectionRange(start+replacement.length,start+replacement.length);el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertReplacementText',data:replacement}));return;}
 const r=range(current,start,end);if(!r)throw Error('This passage cannot be replaced safely. Copy the suggestion instead.');
 const selection=getSelection();selection.removeAllRanges();selection.addRange(r);
 if(!document.execCommand('insertText',false,replacement))throw Error('This editor did not accept the change. Copy the suggestion instead.');
}
root.SupportWritingEditor={eligible,read,range,apply};
})(globalThis);
