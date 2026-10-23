(function(root){
'use strict';
let dictionary;const cache=new Map();
const common={teh:'the',recieved:'received',recieve:'receive',mesage:'message',seperate:'separate',occured:'occurred',definately:'definitely',adress:'address'};
async function load(){if(!dictionary)dictionary=Promise.all(['aff','dic'].map(ext=>fetch(chrome.runtime.getURL('writing/vendor/en-GB.'+ext)).then(r=>{if(!r.ok)throw Error('Offline dictionary could not load.');return r.text();}))).then(([aff,dic])=>{const spell=root.SupportNspell({aff,dic});for(const word of ['Rocket','Ollama','Gemma','UPI','GST','rupee','rupees','lakh','lakhs','crore','crores','prepone','preponed','preponing','Aadhaar','Bengaluru','Mumbai','Chennai','Hyderabad'])spell.add(word);return spell;}).catch(e=>{dictionary=null;throw e;});return dictionary;}
async function check(text,ignored=[]){
 if(typeof text!=='string'||text.length>20000)throw Error('Spelling supports drafts up to 20,000 characters.');
 const spell=await load(),skip=new Set(ignored.map(w=>w.toLowerCase())),edits=[];
 const protectedSpans=[...text.matchAll(/https?:\/\/\S+|[\w.+-]+@[\w.-]+|`[^`]*`|\b\w*[_\d]\w*\b/g)].map(m=>[m.index,m.index+m[0].length]);
 let unknown=0;
 for(const match of text.matchAll(/\b[A-Za-z]+(?:['’][A-Za-z]+)?\b/g)){
  const original=match[0],word=original.replace(/’/g,"'"),start=match.index;
  if(word.length<2||word.length>40||/^[A-Z]{2,}$/.test(word)||skip.has(word.toLowerCase())||protectedSpans.some(([a,b])=>start>=a&&start<b)||spell.correct(word))continue;
  if(++unknown>30)break;
  let alternatives=cache.get(word);if(!alternatives){const known=common[word.toLowerCase()];const preferred=known?(/^[A-Z]/.test(word)?known[0].toUpperCase()+known.slice(1):known):null;alternatives=[...new Set([...(preferred?[preferred]:[]),...spell.suggest(word)])].slice(0,3);if(cache.size>500)cache.clear();cache.set(word,alternatives);}
  if(!alternatives.length)continue;
  edits.push({start,end:start+original.length,original,replacement:alternatives[0],alternatives,kind:'spelling',reason:'Spelling suggestion (Indian English).'});
 }
 return {edits};
}
root.SupportSpelling={check};
})(globalThis);
