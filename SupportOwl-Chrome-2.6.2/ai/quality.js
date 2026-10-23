(function(root){
'use strict';
function urls(text){return (text.match(/https?:\/\/[^\s<>"\]\)]+/g)||[]).map(url=>url.replace(/[.,;!?]+$/,''));}
function requirements(context){
 const text=context.caseText||'',sources=context.sources||[];
 const docs=sources.map(s=>s.text).join('\n').replace(/\*/g,'');
 // A targeted procedure check, not a general intent classifier. Do not infer
 // that a completed, negated or quoted cancellation is a new request.
 const simpleCancel=/^(?:please\s+)?cancel\s+(?:(?:my|the)\s+)?(?:rocket\s+)?subscription[.!?]?$/i.test(text.trim())||/^how (?:can|do) i cancel (?:my |the )?(?:rocket )?subscription\??$/i.test(text.trim());
 const rules=[];
 if(simpleCancel&&/Settings\s*>\s*Subscription/i.test(docs)&&/review the end date/i.test(docs)){
  rules.push({id:'cancel-settings',instruction:'Give the documented Settings > Subscription location.',pattern:/settings\s*(?:>|→|,|\/|and then|then)?\s*subscription/i});
  rules.push({id:'cancel-action',instruction:'Explicitly name the Cancel subscription action.',pattern:/cancel\s+(?:your\s+)?subscription/i});
  rules.push({id:'cancel-confirm',instruction:'Tell the customer to review the end date and confirm cancellation.',pattern:/review[^.\n]{0,60}end date/i});
  rules.push({id:'cancel-confirm-action',instruction:'Include the final confirmation step.',pattern:/confirm/i});
 }
 return rules;
}
function check(reply,context){
 const issues=[],allowed=new Set(context.allowedUrls||[]);
 if(/\b(?:our records (?:show|indicate)|(?:we|i) (?:can )?see (?:that )?your account)\b/i.test(reply)&&!/(?:verified agent findings|agent findings):/i.test(context.caseText||''))issues.push('Do not claim access to account records. This case contains no explicit verified agent findings.');
 for(const url of urls(reply))if(!allowed.has(url))issues.push('Remove or replace the unsupported URL with an exact supplied source URL.');
 for(const paragraph of reply.split(/\n\s*\n/)){
  const namedReference=/\b(?:more|further|additional) (?:information|details)\b[^.\n]{0,100}\b(?:section|guide|documentation|faq)\b/i.test(paragraph);
  const promisesReference=/(?:\b(?:see|read|refer to|visit|consult|check out)\b[^.\n]{0,100}\b(?:docs|documentation|guide|faq|article)\b|\b(?:details|instructions|guidance|information|guide|documentation|link)\b[^.\n]{0,100}\bhere\b|\bhere\b[^.\n]{0,60}\b(?:link|guide|documentation)\b)/i.test(paragraph);
  const markdownReference=/\[[^\]]+\]\((?!https?:\/\/)[^)]*\)/i.test(paragraph);
  if((promisesReference||markdownReference||namedReference)&&!urls(paragraph).some(url=>allowed.has(url)))issues.push('A document reference has no usable supplied URL in its paragraph. Include an exact source URL or remove the reference.');
 }
 if(context.situation==='reason-missing'){
  if(!/\b(?:why|reason|what (?:led|prompted|happened))\b/i.test(reply))issues.push('Ask what led to the refund request; no reason has been supplied.');
  if(/\b(?:dissatisfied|frustrat\w*|iterative|one-shot|prompts?|tutorials?)\b/i.test(reply)||/prompt-library/.test(reply))issues.push('Do not assume dissatisfaction or development problems. Remove tutorials and unrelated advice from this unspecified refund request.');
 }
 if(context.situation==='credit-reset'){
  const docText=(context.sources||[]).map(s=>s.text).join(' ');
  if(/cancel[\s\S]*credits[\s\S]*billing cycle/i.test(docText)){
   if(!/cancel/i.test(reply)||!/end of (?:the |your |this )?(?:current )?billing cycle/i.test(reply))issues.push('Explain the documented cancellation condition and credit expiry at the end of the billing cycle before asking a follow-up.');
   if(!urls(reply).some(url=>allowed.has(url)))issues.push('Include the exact supporting Docs URL for the credit-reset explanation.');
   const confirmed=/\b(?:i|we) (?:have |already )?(?:cancelled|canceled)\b|subscription (?:was|is|has been) cancel/i.test(context.caseText);
   if(!confirmed&&!/\b(?:if|whether)\b|(?:did|have) you cancel|confirm[^.?!]{0,90}cancel/i.test(reply))issues.push('Cancellation is not confirmed in this case. Explain it conditionally and ask whether cancellation took effect; do not assert it happened.');
  }
  if(/\b(?:why|reason)[^.?!]{0,60}refund|what (?:led|prompted)[^.?!]{0,60}refund|which[^?]{0,50}prompts?/i.test(reply))issues.push('The credit reset is already the stated refund reason. Do not ask for the reason again or ask about development prompts.');
 }
 const supplied=context.creditLossDetails;
 if(supplied?.action&&/\b(?:which|what)\s+(?:specific\s+)?(?:prompts?|actions?)\b|\b(?:provide|share|send)\b[^?]{0,100}\b(?:prompts?|actions?)\b/i.test(reply))issues.push('The prompt/action was already supplied. Do not ask the customer for it again; use the original case.');
 if(supplied?.calculation&&/\bhow\b[^?]{0,60}\bcalculat|\b(?:provide|share|send)\b[^?]{0,100}\bcalculation/i.test(reply))issues.push('The before-and-after credit balance was already supplied. Do not ask how the loss was calculated again.');
 if(supplied?.action&&supplied?.calculation&&/\b(?:provide|share|send)\b[^?]{0,100}\b(?:evidence|details|information|specifics)\b/i.test(reply))issues.push('The required loss evidence is already supplied. Do not ask for generic evidence or details again. Acknowledge the provided prompt and balance change and offer review.');
 for(const rule of requirements(context))if(!rule.pattern.test(reply.replace(/\*/g,'')))issues.push(rule.instruction);
 return [...new Set(issues)];
}
root.SupportQuality={check,requirements};if(typeof module!=='undefined')module.exports=root.SupportQuality;
})(globalThis);
