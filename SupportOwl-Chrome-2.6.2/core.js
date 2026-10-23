(function(root){
'use strict';
const kinds=['article','template','snippet','shortcut'];
const words=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
const stem=w=>/^cancel(?:s|led|ed|ling|ing|lation|lations)?$/.test(w)?'cancel':w.length>4&&w.endsWith('s')?w.slice(0,-1):w;
const tokens=s=>words(s).map(stem);
function normalize(raw,entries=[]){
 if(!raw||!kinds.includes(raw.kind))throw Error('Choose an item type.');
 const e={id:raw.id||crypto.randomUUID(),kind:raw.kind,updated:Date.now()};
 if(typeof e.id!=='string'||e.id.length>100)throw Error('Invalid item ID.');
 for(const [key,limit]of Object.entries({title:200,body:500000,alias:80,source:2000,tags:1000})){
  if(raw[key]!=null&&typeof raw[key]!=='string')throw Error('Invalid '+key);
  e[key]=raw[key]||'';if(key!=='body')e[key]=e[key].trim();if(e[key].length>limit)throw Error(key+' is too long.');
 }
 if(!e.title||!e.body.trim())throw Error('Add a title and text.');
 if(e.alias){e.alias=e.alias.replace(/^(?:;;|\/)/,'');if(!e.alias||/[\s/;]/.test(e.alias))throw Error('Use a command without spaces, slashes, or semicolons.');e.alias='/'+e.alias;}
 if(e.alias&&entries.some(x=>x.id!==e.id&&x.alias?.toLowerCase()===e.alias.toLowerCase()))throw Error('That command is already in use.');
 if(e.source&&!/^https?:$/.test(new URL(e.source).protocol))throw Error('Use an http or https source link.');
 return e;
}
function near(a,b){if(Math.abs(a.length-b.length)>1)return false;if(a.length===b.length){const ix=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])ix.push(i);return ix.length===1||(ix.length===2&&ix[1]===ix[0]+1&&a[ix[0]]===b[ix[1]]&&a[ix[1]]===b[ix[0]]);}if(a.length>b.length)[a,b]=[b,a];let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{j++;if(++n>1)return false;}}return true;}
class Index{
 constructor(entries=[]){this.rebuild(entries);}
 rebuild(entries){this.docs=entries.map(e=>({e,title:tokens(e.title+' '+e.alias),heading:tokens(e.body.split('\n').filter(l=>/^#+\s/.test(l)).join(' ')),body:new Set(tokens(e.body+' '+e.tags))}));this.vocab=new Set(this.docs.flatMap(d=>[...d.body,...d.title]));}
 search(query='',kind=''){
 query=query.replace(/\b(?:stop (?:my )?renewal|end (?:my )?plan)\b/gi,'cancel subscription').replace(/money back/gi,'refund');
 const stop=new Set('a an the to of in for is it this that with my me i we you your can could please how do does'.split(' '));
 const q=[...new Set(tokens(query).filter(t=>!stop.has(t)))].slice(0,40);
 const alternatives=new Map(q.map(t=>[t,this.vocab.has(t)?[t]:[...this.vocab].filter(w=>t.length>=3&&w.startsWith(t)||t.length>=5&&near(w,t)).slice(0,12)]));
 return this.docs.filter(d=>!kind||(kind==='reply'?['template','snippet','shortcut'].includes(d.e.kind):d.e.kind===kind)).map(d=>{
  let score=0,matched=[];for(const t of q){const vs=alternatives.get(t);const n=Math.max(0,...vs.map(v=>(d.title.includes(v)?40:0)+(d.heading.includes(v)?14:0)+(d.body.has(v)?1:0)));if(n){score+=n;matched.push(t);}}
  score*=q.length?0.4+0.6*matched.length/q.length:1;
  // Prefer a dedicated guide over a broad FAQ when both match equally.
  if(q.length&&!q.includes('faq')&&/^(?:faqs?|frequently asked questions)$/i.test(d.e.title))score*=0.9;
  const lines=d.e.body.split('\n');let best=0,at=0;
  lines.forEach((line,i)=>{const ts=tokens(line),n=q.filter(t=>alternatives.get(t).some(v=>ts.includes(v))).length;const rank=n*4+(n&&/^#+\s/.test(line)?2:0);if(rank>best){best=rank;at=i;}});
  const heading=lines.slice(0,at+1).reverse().find(l=>/^#+\s/.test(l))?.replace(/^#+\s*/,'');
  return {entry:d.e,score,excerpt:lines.slice(at,at+4).join(' ').replace(/#+\s/g,'').slice(0,320),sectionUrl:q.length&&heading&&d.e.source?d.e.source.split('#')[0]+'#:~:text='+encodeURIComponent(heading):'',matched};
 }).filter(h=>!q.length||h.score).sort((a,b)=>b.score-a.score||b.entry.updated-a.entry.updated).slice(0,60);
 }
}
function sections(entry){
 if(!entry.source)return [];
 const base=entry.source.split('#')[0],seen=new Set();
 return entry.body.split('\n').filter(line=>/^#{1,6}\s+/.test(line)).map(line=>line.replace(/^#+\s*/, '').replace(/\s+#+\s*$/, '').trim()).filter(title=>title&&!seen.has(title)&&seen.add(title)).map(title=>({title,url:base+'#:~:text='+encodeURIComponent(title).replace(/-/g,'%2D')}));
}
function capture(items,text){if(typeof text!=='string'||!text.trim()||text.length>100000)return items;return [{id:crypto.randomUUID(),text},...items.filter(i=>i.text!==text)].slice(0,10);}
function commandMatch(text,entries){const m=text.match(/(?:^|\s);;([^\s;]*)$/);if(!m)return null;return {start:text.length-m[1].length-2,length:m[1].length+2,hits:entries.filter(e=>e.alias?.slice(1).toLowerCase().startsWith(m[1].toLowerCase())).sort((a,b)=>a.alias.localeCompare(b.alias)).slice(0,8)};}
root.SupportCore={kinds,normalize,Index,capture,commandMatch,sections};if(typeof module!=='undefined')module.exports=root.SupportCore;
})(globalThis);
