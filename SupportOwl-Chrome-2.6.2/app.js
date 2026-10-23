if(new URL(location.href).searchParams.has('panel'))document.body.className='sidepanel';
const assistant=SupportUI.mount(document.getElementById('app'));
chrome.storage.onChanged.addListener(()=>assistant.refresh().catch(assistant.showError));
(async()=>{await assistant.ready;const {pending}=await chrome.storage.session.get('pending');if(pending){await chrome.storage.session.remove('pending');if(pending.type==='newArticle')await assistant.newArticle(pending);else await assistant.open(pending.text);}})().catch(assistant.showError);
