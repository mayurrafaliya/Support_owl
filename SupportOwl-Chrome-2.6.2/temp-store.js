(function(root){
'use strict';
const limits={file:2*1024*1024,text:100000,budget:6*1024*1024,count:40};
const estimate=items=>JSON.stringify(items).length*2;
function normalize(raw){
 if(!raw||!['text','file'].includes(raw.kind))throw Error('Add text or a file.');
 const item={id:crypto.randomUUID(),kind:raw.kind,name:'',size:0};
 if(raw.kind==='text'){
  if(typeof raw.text!=='string'||!raw.text.trim()||raw.text.length>limits.text)throw Error('Add text up to 100,000 characters.');
  item.text=raw.text;item.name='Saved text';item.size=raw.text.length*2;
 }else{
  if(typeof raw.data!=='string'||raw.data.length>Math.ceil(limits.file/3)*4||(raw.data.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(raw.data)))throw Error('Choose a file up to 2 MB.');
  item.size=raw.data.length/4*3-(raw.data.endsWith('==')?2:raw.data.endsWith('=')?1:0);
  if(item.size>limits.file)throw Error('Choose a file up to 2 MB.');
  item.name=String(raw.name||'file').replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(0,160)||'file';
  item.mime=typeof raw.mime==='string'&&/^[\w.+-]+\/[\w.+-]+$/.test(raw.mime)?raw.mime:'application/octet-stream';
  item.data=raw.data;
 }
 return item;
}
function add(current,rawItems){
 if(!Array.isArray(rawItems)||!rawItems.length||rawItems.length>limits.count)throw Error('Add between 1 and 40 items.');
 const incoming=rawItems.map(normalize);const next=[...incoming,...current];
 if(next.length>limits.count)throw Error('The temporary store holds 40 items. Remove some before adding more.');
 if(estimate(next)>limits.budget)throw Error('Temporary storage is full. Download or remove an item to make space. Nothing was replaced.');
 return next;
}
function list(items){return {items:items.map(({data,...meta})=>meta),used:estimate(items),limit:limits.budget};}
root.SupportTemp={limits,estimate,normalize,add,list};if(typeof module!=='undefined')module.exports=root.SupportTemp;
})(globalThis);
