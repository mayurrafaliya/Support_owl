/* Measure text without inserting markup into the user's editor. */
(function(root){
'use strict';
function point(el,offset){
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,last;
 while((n=walker.nextNode())){last=n;if(offset<=n.length)return [n,offset];offset-=n.length;}
 return last?[last,last.length]:[el,0];
}
function clip(r,b){
 const left=Math.max(r.left,b.left),right=Math.min(r.right===r.left?r.right+1:r.right,b.right),top=Math.max(r.top,b.top),bottom=Math.min(r.bottom,b.bottom);
 return right>left&&bottom>top?{left,right,top,bottom,width:right-left,height:bottom-top}:null;
}
function rects(el,start,end,mappedRange){
 const box=el.getBoundingClientRect(),style=getComputedStyle(el);
 if(!box.width||!box.height)return [];
 let container=el,mirror;
 // Complex editors use the nearby popup, rather than guessing DOM offsets.
 if(!mappedRange&&!('value' in el)&&el.querySelector('div,p,br,li,table,img,iframe,[contenteditable=false]'))return [];
 try{
  if('value' in el){
   // Rotated/scaled fields need editor-specific geometry.
   if(Math.abs(box.width-el.offsetWidth)>2||Math.abs(box.height-el.offsetHeight)>2)return [];
   mirror=document.createElement('div');mirror.dataset.supportOwl='measurement';
   const shadow=mirror.attachShadow({mode:'closed'});container=document.createElement('div');
   mirror.style.cssText='all:initial!important;position:fixed!important;left:0!important;top:0!important;visibility:hidden!important;pointer-events:none!important;';
   for(const prop of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','fontStretch','lineHeight','letterSpacing','wordSpacing','textTransform','textIndent','textAlign','direction','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'])container.style[prop]=style[prop];
   Object.assign(container.style,{position:'fixed',left:box.left+'px',top:box.top+'px',boxSizing:'border-box',width:box.width+'px',height:box.height+'px',borderStyle:'solid',whiteSpace:el instanceof HTMLInputElement?'pre':'pre-wrap',overflowWrap:'break-word',overflow:'hidden'});
   // Match the actual text viewport, including textarea scrollbar width.
   container.style.width=(el.clientWidth+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))+'px';
   container.textContent=el.value;shadow.append(container);document.documentElement.append(mirror);
   container.scrollTop=el.scrollTop;container.scrollLeft=el.scrollLeft;
  }
  const range=mappedRange||document.createRange();if(!mappedRange){range.setStart(...point(container,start));range.setEnd(...point(container,end));}
  const bounds={left:Math.max(0,box.left+el.clientLeft),right:Math.min(innerWidth,box.left+el.clientLeft+el.clientWidth),top:Math.max(0,box.top+el.clientTop),bottom:Math.min(innerHeight,box.top+el.clientTop+el.clientHeight)};
  // Respect scrollable ancestors as well as the field itself.
  for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(s.overflowX)){bounds.left=Math.max(bounds.left,b.left);bounds.right=Math.min(bounds.right,b.right);}if(/hidden|auto|scroll|clip/.test(s.overflowY)){bounds.top=Math.max(bounds.top,b.top);bounds.bottom=Math.min(bounds.bottom,b.bottom);}}
  return Array.from(range.getClientRects(),r=>clip(r,bounds)).filter(Boolean);
 }finally{mirror?.remove();}
}
root.SupportWritingGeometry={rects,clip};
if(typeof module!=='undefined')module.exports={clip};
})(globalThis);
