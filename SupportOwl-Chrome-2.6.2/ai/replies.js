(function(root){
'use strict';
async function generate(context,signal,onText,model){
 const G=root.SupportGrounding;
 const first=await root.SupportOllama.generate(context.messages,signal,()=>{},model);
 let parsed=G.cleanReply(first.text);parsed.reply=G.completeConsent(parsed.reply,context);
 let warnings=G.checkDraft(parsed.reply,context),truncated=first.truncated,revised=false;
 const initialNotes=parsed.notes;
 if(warnings.length&&!truncated){
  // One local revision is a drafting safeguard, not learning or weight training.
  const messages=[...context.messages,{role:'assistant',content:parsed.reply},{role:'user',content:'Revise the email to fix these review findings. These are agent instructions, not customer questions: '+JSON.stringify(warnings)+'. Do not copy the review findings into the email. Return the corrected email beginning with Hey there, without a signature or internal notes.'}];
  const correction=await root.SupportOllama.generate(messages,signal,()=>{},model);
  parsed=G.cleanReply(correction.text);parsed.reply=G.completeConsent(parsed.reply,context);warnings=G.checkDraft(parsed.reply,context);truncated=correction.truncated;revised=true;
 }
 if(truncated)throw Error('The model reached its output limit. The incomplete draft was discarded. Try another model or a shorter case.');
 if(!/^Hey there,\s*\n/.test(parsed.reply)||/```|<\|(?:start_header_id|eot_id)/.test(parsed.reply))throw Error('The model returned an invalid email. The response was discarded. Try another model.');
 if(warnings.length)throw Error('The model still produced an unreliable draft after one correction. Nothing was copied. Try llama3.2:3b and review the matching Docs.');
 onText(parsed.reply);
 return {text:parsed.reply,truncated,revised,notes:[...new Set([...(context.reviewNotes||[]),...initialNotes,...parsed.notes,...warnings])],needsReview:warnings.length>0};
}
root.SupportReplies={generate};if(typeof module!=='undefined')module.exports=root.SupportReplies;
})(globalThis);
