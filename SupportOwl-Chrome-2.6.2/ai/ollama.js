(function(root){
'use strict';
const BASE='http://127.0.0.1:11434';
async function request(path,body,signal){
 if(root.SupportConnection)await root.SupportConnection.prepare();
 if(signal?.aborted)throw signal.reason||Error('Cancelled.');
 let response;
 try{response=await fetch(BASE+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal,credentials:'omit',redirect:'error'});}catch(e){if(signal?.aborted)throw e;const error=Error('Cannot reach Ollama. Open Ollama and keep it running, then click Check connection.');error.code='OLLAMA_UNREACHABLE';throw error;}
 if(!response.ok){if(response.status===403){const error=Error('Ollama rejected local access (403). Reload Support Owl in chrome://extensions, reopen this panel, and click Check connection. See Connection help if it continues.');error.code='ORIGIN_BLOCKED';throw error;}if(response.status===404)throw Error('The model is not installed. Open Ollama to install a model, then check the connection again.');throw Error('Ollama returned an error ('+response.status+'). Check that Ollama is running and has enough free memory.');}
 return response;
}
async function stream(response,onItem){
 if(!response.body)throw Error('Ollama returned an empty response.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
 function consume(line){if(!line.trim())return;const item=JSON.parse(line);if(item.error)throw Error(String(item.error).slice(0,400));onItem(item);}
 try{while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});if(pending.length>2000000)throw Error('Ollama response is too large.');const lines=pending.split('\n');pending=lines.pop();for(const line of lines)consume(line);}pending+=decoder.decode();consume(pending);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function check(signal){
 const data=await(await request('/api/tags',null,signal)).json();
 const models=(Array.isArray(data.models)?data.models:[]).filter(m=>!m.remote_host&&!m.remote_model&&(!Array.isArray(m.capabilities)||m.capabilities.includes('completion'))).map(m=>m.name||m.model).filter(name=>typeof name==='string'&&!/(?:^|[-:])cloud(?:$|[-:])/i.test(name));
 // GET may succeed without Origin while POST is rejected. Verify actual model access.
 if(models.length)await validateModel(models.includes('gemma4:e4b')?'gemma4:e4b':models.includes('support-owl-repaired:latest')?'support-owl-repaired:latest':models.includes('llama3.2:3b')?'llama3.2:3b':models[0],signal);
 return {models};
}
async function validateModel(model,signal){
 if(typeof model!=='string'||!model||model.length>200)throw Error('Choose an installed model.');
 const data=await(await request('/api/show',{model},signal)).json();
 if(data.remote_host||data.remote_model)throw Error('Choose a local model. Cloud models are not supported.');
 if(Array.isArray(data.capabilities)&&!data.capabilities.includes('completion'))throw Error('This model cannot generate replies. Choose a text-generation model in Ollama.');
 const nativeGemma=model==='gemma4:e4b'&&data.details?.runner==='mlx'&&data.details?.family==='gemma4';
 if(!nativeGemma&&!data.renderer&&typeof data.template==='string'&&/^\s*{{\s*\.Prompt\s*}}\s*$/.test(data.template))throw Error('This model has no chat template and cannot reliably follow reply instructions. Choose an official chat model such as gemma4:e4b.');
 return data;
}
async function generateStream(messages,signal,onText,model,config={}){const info=await validateModel(model,signal);let output='',done=false,reason='';await stream(await request('/api/chat',{model,messages,stream:true,...(config.format?{format:config.format}:{}),...(info.capabilities?.includes('thinking')?{think:false}:{}),keep_alive:'15m',options:{...(model.startsWith('gemma4:')?{temperature:1,top_p:0.95,top_k:64}:{temperature:0.1}),...(Number.isFinite(config.temperature)?{temperature:Math.max(0,Math.min(1,config.temperature))}:{}),num_ctx:Math.max(4096,Math.min(16384,config.numCtx||8192)),num_predict:config.maxTokens||1200}},signal),item=>{if(item.message?.content){output+=item.message.content;if(/\s{256}$/.test(output)){const error=Error('The model stalled while formatting its response. Generation stopped. Try again.');error.code='MODEL_FORMAT_STALL';throw error;}if(output.length>30000)throw Error('The draft is too long. Try a shorter customer message.');if(repeats(output))throw Error('The model started repeating itself. Generation stopped. Choose another model or shorten the case.');onText(output);}if(item.done){done=true;reason=item.done_reason;}});if(!done)throw Error('Generation was interrupted. Please generate again.');if(!output.trim())throw Error('The model returned no reply. Please try again.');return {text:output,truncated:reason==='length'};}
function repeats(text){
 const words=text.toLowerCase().match(/\S+/g)||[];
 // Stop sustained repeated passages without confusing normal repeated words.
 for(let width=8;width<=80;width++){
  if(words.length<width*3)continue;
  const end=words.length,part=words.slice(end-width).join(' ');
  if(part===words.slice(end-width*2,end-width).join(' ')&&part===words.slice(end-width*3,end-width*2).join(' '))return true;
 }
 return false;
}
async function generate(messages,signal,onText,model,config={}){
 const bounded=new AbortController();let timedOut=false;
 const cancel=()=>bounded.abort(signal.reason);
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;bounded.abort();},90000);
 try{return await generateStream(messages,bounded.signal,onText,model,config);}
 catch(error){if(timedOut)throw Error('The model did not finish within 90 seconds. Generation stopped. Try a shorter case or another installed model.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
root.SupportOllama={BASE,check,generate,repeats};if(typeof module!=='undefined')module.exports=root.SupportOllama;
})(globalThis);
