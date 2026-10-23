(function(root){
'use strict';
function text(value){if(typeof value!=='string'||!value.trim()||value.trim().length>320)throw Error('Use a writing preference between 1 and 320 characters.');const s=value.trim();if(/https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{4,}\b/i.test(s))throw Error('Keep account details, email addresses and links out of writing preferences.');return s;}
function save(items,input){const value=text(input.text);if(input.id&&!items.some(e=>e.id===input.id))throw Error('This preference no longer exists.');const existing=input.id||items.find(e=>e.text.toLowerCase()===value.toLowerCase())?.id;const next=items.filter(e=>e.id!==existing);if(next.length>=40)throw Error('You have 40 preferences. Edit or remove an existing preference first.');return [{id:existing||crypto.randomUUID(),text:value,updated:Date.now()},...next];}
function select(items){let remaining=1600;return [...items].sort((a,b)=>b.updated-a.updated).filter(e=>{try{text(e.text);}catch{return false;}if(e.text.length>remaining)return false;remaining-=e.text.length;return true;}).slice(0,8).map(e=>e.text);}
root.SupportPreferences={text,save,select};if(typeof module!=='undefined')module.exports=root.SupportPreferences;
})(globalThis);
