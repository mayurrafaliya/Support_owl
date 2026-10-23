(function(root){
'use strict';
const URL='https://www.rocket.new/terms-service';
function relevant(text){return /\b(refund\w*|terms|conditions|contract\w*|non.refundable|warrant\w*|liabilit\w*|indemn\w*|termination|ownership|intellectual property|confidential\w*|payment terms|billing dispute|fees)\b/i.test(text);}
function select(text,entries){
 if(!relevant(text))return [];
 const policy=entries.find(e=>e.rocketManaged&&e.officialSource==='terms'&&e.source===URL);
 if(!policy)throw Error('The official terms index is unavailable. Refresh sources before answering a policy question.');
 const sections=policy.body.split(/\n(?=#{1,3}\s)/).map((body,i)=>({id:'terms:'+i,kind:'article',title:body.split('\n')[0].replace(/^#+\s*/,''),body,updated:policy.updated})).filter(s=>s.body.length>60);
 const ranked=new root.SupportCore.Index(sections).search(text,'article').map(h=>h.entry);
 const refund=/refund|non.refundable|money back|fees/i.test(text);
 // Keep refund restrictions AND explicit remedy exceptions together, never clipped.
 const required=refund?sections.filter(s=>/refund|reimburse/i.test(s.body)):[];
 const chosen=[],seen=new Set();let used=0;
 for(const section of [...required,...ranked]){if(seen.has(section.id))continue;if(used+section.body.length>9000){if(required.includes(section))throw Error('The refund policy grew beyond the safe context limit. Review the full terms before drafting.');continue;}chosen.push({title:'Rocket Terms of Service',heading:section.title,text:section.body,url:URL,authority:'terms',checkedAt:policy.checkedAt});used+=section.body.length;seen.add(section.id);if(chosen.length>=10&&required.every(s=>seen.has(s.id)))break;}
 return chosen;
}
root.SupportPolicy={select,relevant};
})(globalThis);
