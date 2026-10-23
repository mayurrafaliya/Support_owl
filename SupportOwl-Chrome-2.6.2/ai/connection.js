(function(root){
'use strict';
const RULE_ID=19401;
let prepared;
function rule(extensionId){
 return {
  id:RULE_ID,priority:1,
  action:{type:'modifyHeaders',requestHeaders:[{header:'origin',operation:'remove'}]},
  condition:{
   initiatorDomains:[extensionId],
   regexFilter:'^http://127\\.0\\.0\\.1:11434/api/(tags|show|chat)$',
   requestMethods:['get','post'],resourceTypes:['xmlhttprequest']
  }
 };
}
async function prepare(){
 if(prepared)return prepared;
 prepared=(async()=>{
  if(!root.chrome?.declarativeNetRequest?.updateSessionRules)throw Error('Reload Support Owl in chrome://extensions to enable the updated local connection.');
  if(!await chrome.permissions.contains({origins:['http://127.0.0.1/*']}))throw Error('Click Check connection and allow Support Owl to access Ollama on this laptop.');
  // Host permission authorizes local access. Scope compatibility to this extension,
  // this port, and these three read/generate endpoints; website requests never match.
  await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[RULE_ID],addRules:[rule(chrome.runtime.id)]});
 })();
 try{return await prepared;}catch(error){prepared=null;error.code='LOCAL_CONNECTION_SETUP';throw error;}
}
root.SupportConnection={prepare};
})(globalThis);
