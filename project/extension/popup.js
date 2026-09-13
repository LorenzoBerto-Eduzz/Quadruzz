const BASE='https://cross-quadruzz.l-busslerberto.chatgpt.site';
const app=document.querySelector('#app');
const imageUrls=new Map();
let refreshTimer=null;
let stopped=false;
let latestData=null;
let latestImages=[];
let pickerOpen=false;
let roleFilter='';
let savingRole=false;

document.querySelector('#close').addEventListener('click',()=>{try{const sent=chrome.runtime.sendMessage({type:'quadruzz-close'});if(sent?.catch)sent.catch(()=>{})}catch{/* Context already closed. */}});
window.addEventListener('keydown',event=>{if(event.repeat||event.code!=='KeyW'||!event.altKey||!event.shiftKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopImmediatePropagation();try{const sent=chrome.runtime.sendMessage({type:'quadruzz-toggle'});if(sent?.catch)sent.catch(()=>{})}catch{/* Context already closed. */}},true);
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='quadruzz-connect-started')connectingView();if(message?.type==='quadruzz-connect-complete')void loadMembers();if(message?.type==='quadruzz-connect-cancelled')signInView()});

function storageCall(method,value){return new Promise((resolve,reject)=>{try{chrome.storage.local[method](value,result=>{try{const failure=chrome.runtime.lastError;if(failure)reject(new Error(failure.message));else resolve(result)}catch(error){reject(error)}})}catch(error){reject(error)}})}
const storage={get:key=>storageCall('get',key),set:value=>storageCall('set',value),remove:key=>storageCall('remove',key)};
function reportSize(){window.parent.postMessage({type:'quadruzz-resize',height:document.body.scrollHeight},'*')}
function reportReady(){reportSize();window.parent.postMessage({type:'quadruzz-ready'},'*')}
async function api(path,options={}){const{token}=await storage.get('token');const headers={...(options.headers||{}),...(token?{authorization:`Bearer ${token}`}:{})};const response=await fetch(`${BASE}${path}`,{...options,headers});if(response.status===401)await storage.remove('token');return response}
async function pulseActivity(){try{const stored=await storage.get(['token','extensionActivitySessionId','extensionActivityPulseAt']);if(!stored.token)return;const now=Date.now();if(now-(stored.extensionActivityPulseAt||0)<15000)return;const extensionSessionId=stored.extensionActivitySessionId||crypto.randomUUID();await storage.set({extensionActivitySessionId,extensionActivityPulseAt:now});const response=await fetch(`${BASE}/api/extension`,{method:'POST',headers:{authorization:`Bearer ${stored.token}`,'content-type':'application/json'},body:JSON.stringify({extensionAction:'heartbeat',extensionSessionId})});if(response.status===401)await storage.remove(['token','extensionActivityPulseAt']);else if(!response.ok)await storage.remove('extensionActivityPulseAt')}catch(error){if(!stopInvalidContext(error))try{await storage.remove('extensionActivityPulseAt')}catch{/* The next member refresh retries. */}}}
function connectingView(){app.innerHTML='<div class="connect"><button class="primary" disabled>Connecting to Cross…</button></div>';reportReady()}
function waitingView(){app.innerHTML='<div class="connect"><button class="primary" id="open-hq">Waiting for approval</button></div>';document.querySelector('#open-hq').addEventListener('click',()=>chrome.runtime.sendMessage({type:'quadruzz-open-hq'}));reportReady()}
function signInView(){app.innerHTML='<div class="connect"><button class="primary" id="sign-in">Connect to Cross</button></div>';document.querySelector('#sign-in').addEventListener('click',signIn);reportReady()}
async function signIn(){connectingView();try{await chrome.runtime.sendMessage({type:'quadruzz-connect'})}catch{signInView()}}
async function connectionPending(){try{return Boolean((await chrome.runtime.sendMessage({type:'quadruzz-connect-state'}))?.connecting)}catch{return false}}
async function memberImage(member,token){const key=`${member.userId}:${member.imageVersion}`;if(imageUrls.has(key))return imageUrls.get(key);const response=await fetch(`${BASE}/api/extension/profile-image?user=${encodeURIComponent(member.userId)}&v=${member.imageVersion}`,{headers:{authorization:`Bearer ${token}`}});if(!response.ok)return'';const url=URL.createObjectURL(await response.blob());imageUrls.set(key,url);return url}
function esc(value){const node=document.createElement('span');node.textContent=value??'';return node.innerHTML}
function stopInvalidContext(error){if(!/extension context invalidated/i.test(String(error)))return false;stopped=true;if(refreshTimer)clearInterval(refreshTimer);return true}
function matchingRoles(){const query=roleFilter.trim().toLocaleLowerCase();return (latestData?.roleStatuses||[]).filter(role=>!query||role.toLocaleLowerCase().includes(query))}
function closeRolePicker(){pickerOpen=false;roleFilter='';renderMembers()}
function rolePickerMarkup(memberIndex){
  const roles=matchingRoles();
  return `<li class="role-picker" style="top:${(memberIndex+1)*42}px"><input id="role-filter" maxlength="30" value="${esc(roleFilter)}" aria-label="Find or create role status" autocomplete="off" spellcheck="false"><div class="role-options">${roles.map((role,index)=>`<button class="role-option" data-index="${index}" type="button">${esc(role)}</button>`).join('')}</div></li>`;
}
function bindRolePicker(){
  const trigger=document.querySelector('.role-trigger');
  if(trigger)trigger.addEventListener('click',()=>{pickerOpen=!pickerOpen;roleFilter='';renderMembers()});
  if(!pickerOpen)return;
  const input=document.querySelector('#role-filter');
  const options=()=>[...document.querySelectorAll('.role-option')];
  input.addEventListener('input',event=>{roleFilter=event.target.value;renderMembers()});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();void chooseRole(input.value,true);return}
    if(event.key==='Escape'){event.preventDefault();closeRolePicker();return}
    if((event.key==='Tab'||event.key==='ArrowDown')&&options().length){event.preventDefault();options()[event.shiftKey?options().length-1:0].focus()}
  });
  options().forEach((button,index)=>{
    button.addEventListener('click',()=>void chooseRole(matchingRoles()[index],false));
    button.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();void chooseRole(matchingRoles()[index],false);return}
      if(event.key==='Escape'){event.preventDefault();closeRolePicker();return}
      if(event.key==='Tab'||event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        const items=options();
        const backwards=event.shiftKey||event.key==='ArrowUp';
        const next=backwards?index-1:index+1;
        if(next<0||next>=items.length)input.focus();else items[next].focus();
      }
    });
  });
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
}
function renderMembers(){
  if(!latestData)return;
  const selfIndex=latestData.members.findIndex(member=>member.userId===latestData.currentUserId);
  const rows=latestData.members.map((member,index)=>{
    const self=member.userId===latestData.currentUserId;
    const row=`<li class="member${member.extensionActive?'':' inactive'}${self?' self':''}"><img src="${latestImages[index]||''}" alt=""><span class="name${self?' own-zone':''}">${esc(member.displayName)}</span>${self?`<button class="state role-trigger" type="button" aria-expanded="${pickerOpen}">${esc(member.actingState)}</button>`:`<span class="state">${esc(member.actingState)}</span>`}</li>`;
    return row;
  }).join('');
  app.innerHTML=`<ul class="members">${rows}${pickerOpen&&selfIndex>=0?rolePickerMarkup(selfIndex):''}</ul>`;
  bindRolePicker();
  reportReady();
}
async function chooseRole(value,create){
  const label=String(value||'').trim().replace(/\s+/g,' ');
  if(!label||label.length>30||savingRole)return;
  savingRole=true;
  const self=latestData?.members.find(member=>member.userId===latestData.currentUserId);
  const previous=self?.actingState;
  if(self)self.actingState=label;
  pickerOpen=false;
  roleFilter='';
  renderMembers();
  try{
    const response=await api('/api/extension',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actingState:label,createActingState:create})});
    if(!response.ok)throw new Error();
    const result=await response.json();
    if(self&&result.actingState)self.actingState=result.actingState;
  }catch(error){
    if(stopInvalidContext(error))return;
    if(self)self.actingState=previous;
    void loadMembers(true);
  }finally{savingRole=false;renderMembers()}
}
async function loadMembers(forceRender=false){
  if(stopped)return;
  try{
    const{token}=await storage.get('token');
    if(!token){if(await connectionPending())connectingView();else signInView();return}
    const response=await api('/api/extension');
    if(response.status===401){if(await connectionPending())connectingView();else signInView();return}
    if(!response.ok)throw new Error();
    const data=await response.json();
    if(data.accessState==='pending'){waitingView();return}
    if(data.accessState!=='approved'){await storage.remove('token');signInView();return}
    await pulseActivity();
    data.members.sort((a,b)=>a.displayName.localeCompare(b.displayName,undefined,{sensitivity:'base'}));
    const images=await Promise.all(data.members.map(member=>memberImage(member,token)));
    latestData=data;
    latestImages=images;
    if(!pickerOpen||forceRender)renderMembers();
  }catch(error){if(stopInvalidContext(error))return;reportReady()}
}
new ResizeObserver(reportSize).observe(document.body);
try{const started=chrome.runtime.sendMessage({type:'quadruzz-authenticated'});if(started?.catch)started.catch(()=>{})}catch{/* The background alarm will retry. */}
void loadMembers();
refreshTimer=setInterval(loadMembers,1000);
window.addEventListener('unload',()=>{stopped=true;if(refreshTimer)clearInterval(refreshTimer)});
