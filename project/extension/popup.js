const BASE='https://cross-quadruzz.l-busslerberto.chatgpt.site';
const app=document.querySelector('#app');
const imageUrls=new Map();
let refreshTimer=null;
let stopped=false;
let latestData=null;
let latestImages=[];
let pickerOpen=false;
let noteOpen=false;
let roleFilter='';
let noteDraft='';
let noteLastValid='';
let savingRole=false;
let savingNote=false;
let pendingRole=null;
let pendingNote=null;
let pendingNoteSet=false;
let pendingNoteUpdatedAt=null;
let nextLoadSequence=0;
let appliedLoadSequence=0;
let lastRenderSignature='';
let pickerDesiredHeight=0;
let roleLayoutFrame=null;
let standaloneRole=false;
let standaloneNote=false;
let standaloneNotification=false;
let pendingPanel=null;
let overlayVisible=false;
let selectedRoleIndex=0;
let presentationId=0;
let focusRequest=0;
let notesInitialized=false;
const knownNoteVersions=new Map();
let notifications=[];
const notificationTimers=new Map();

function focusOverlayInput(){
  const request=++focusRequest;
  const tryFocus=attempt=>{
    if(request!==focusRequest||!overlayVisible)return;
    const input=document.querySelector('#role-filter,#note-input');
    if(!input)return;
    input.focus({preventScroll:true});
    input.setSelectionRange(input.value.length,input.value.length);
    if(document.activeElement!==input&&attempt<5)setTimeout(()=>tryFocus(attempt+1),16*(attempt+1));
  };
  requestAnimationFrame(()=>tryFocus(0));
}

function notificationKey(notification){return `${notification.userId}:${notification.noteUpdatedAt}`}
function clearNotifications(render=true){notifications=[];for(const timer of notificationTimers.values())clearTimeout(timer);notificationTimers.clear();document.querySelector('.note-notifications')?.remove();if(render&&latestData)renderMembers()}
function removeNotification(key){notifications=notifications.filter(item=>notificationKey(item)!==key);const timer=notificationTimers.get(key);if(timer)clearTimeout(timer);notificationTimers.delete(key);if(!notifications.length&&!pickerOpen&&!noteOpen&&standaloneNotification){hideOverlayNow();return}if(latestData)renderMembers()}
function addNotification(notification){if(!notification?.note||notification.userId===latestData?.currentUserId)return;const key=notificationKey(notification);notifications=notifications.filter(item=>notificationKey(item)!==key);notifications.unshift(notification);const previous=notificationTimers.get(key);if(previous)clearTimeout(previous);notificationTimers.set(key,setTimeout(()=>removeNotification(key),5000));if(latestData)renderMembers()}
function notificationMarkup(){if(!notifications.length)return'';return `<div class="note-notifications">${notifications.map(notification=>{const twoLines=noteUsesTwoLines(notification.note);return `<div class="note-notification${twoLines?' two-lines':''}"><div class="notification-identity"><span class="notification-name">${esc(notification.displayName)}</span><span class="notification-role">${esc(notification.actingState)}</span></div><div class="notification-note">${esc(notification.note)}</div></div>`}).join('')}</div>`}
function notificationHeight(){if(!notifications.length)return 0;return notifications.reduce((height,item)=>height+(noteUsesTwoLines(item.note)?42:32),0)+(notifications.length-1)*2}
function detectNoteNotifications(data){const next=new Map();for(const member of data.members){const version=Number(member.noteUpdatedAt||0);next.set(member.userId,version);if(notesInitialized&&member.userId!==data.currentUserId&&member.note&&version&&knownNoteVersions.get(member.userId)!==version){try{const sent=chrome.runtime.sendMessage({type:'quadruzz-note-notification',notification:{userId:member.userId,displayName:member.displayName,actingState:member.actingState,note:member.note,noteUpdatedAt:version}});if(sent?.catch)sent.catch(()=>{})}catch{/* Extension context closed. */}}}knownNoteVersions.clear();for(const [userId,version] of next)knownNoteVersions.set(userId,version);notesInitialized=true}
document.querySelector('#close').addEventListener('click',()=>{try{const sent=chrome.runtime.sendMessage({type:'quadruzz-close'});if(sent?.catch)sent.catch(()=>{})}catch{/* Context already closed. */}});
window.addEventListener('keydown',event=>{const popupToggle=event.code==='KeyW'&&event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey;const roleToggle=event.code==='KeyD'&&event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey;const noteToggle=event.code==='KeyS'&&event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey;if(event.repeat||(!popupToggle&&!roleToggle&&!noteToggle))return;event.preventDefault();event.stopImmediatePropagation();if(overlayVisible&&(roleToggle||noteToggle)){const switchingStandalone=(roleToggle&&standaloneNote)||(noteToggle&&standaloneRole);if(!switchingStandalone){if(roleToggle)requestRolePickerToggle();else requestNoteToggle();return}}try{const type=popupToggle?'quadruzz-toggle':roleToggle?'quadruzz-role-toggle':'quadruzz-note-toggle';const sent=chrome.runtime.sendMessage({type});if(sent?.catch)sent.catch(()=>{})}catch{/* Context already closed. */}},true);
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='quadruzz-connect-started')connectingView();if(message?.type==='quadruzz-connect-complete')void loadMembers();if(message?.type==='quadruzz-connect-cancelled')signInView()});
window.addEventListener('message',event=>{
  if(event.source!==parent)return;
  if(event.data?.type==='quadruzz-dismiss-menus'&&pickerOpen){closeRolePicker();return}
  if(event.data?.type==='quadruzz-role-toggle'){requestRolePickerToggle();return}
  if(event.data?.type==='quadruzz-note-toggle'){requestNoteToggle();return}
  if(event.data?.type==='quadruzz-note-notification'){addNotification(event.data.notification);return}
  if(event.data?.type==='quadruzz-clear-notifications'){clearNotifications(false);return}
  if(event.data?.type==='quadruzz-picker-prepared'){const panel=pendingPanel;pendingPanel=null;if(panel==='role'){pickerOpen=true;noteOpen=false;selectedRoleIndex=0;roleFilter=''}else if(panel==='note'){noteOpen=true;pickerOpen=false;noteDraft='';noteLastValid=''}renderMembers();return}
  if(event.data?.type==='quadruzz-overlay-hidden'){focusRequest+=1;overlayVisible=false;pickerOpen=false;noteOpen=false;standaloneRole=false;standaloneNote=false;standaloneNotification=false;clearNotifications(false);pendingPanel=null;selectedRoleIndex=0;roleFilter='';noteDraft='';noteLastValid='';pickerDesiredHeight=0;document.documentElement.classList.remove('standalone-role','standalone-note');document.querySelector('.role-picker,.note-editor')?.remove();return}
  if(event.data?.type==='quadruzz-presented'){
    if(Number(event.data.presentationId||0)===presentationId)focusOverlayInput();
    return
  }
  if(event.data?.type==='quadruzz-overlay-mode'){
    presentationId=Number(event.data.presentationId||0);
    overlayVisible=event.data.visible===true;
    if(!overlayVisible)return;
    const wasStandaloneRole=standaloneRole;
    const wasStandaloneNote=standaloneNote;
    standaloneRole=event.data.mode==='role';
    standaloneNote=event.data.mode==='note';
    standaloneNotification=event.data.mode==='notification';
    document.documentElement.classList.toggle('standalone-role',standaloneRole);
    document.documentElement.classList.toggle('standalone-note',standaloneNote);
    document.documentElement.classList.toggle('standalone-notification',standaloneNotification);
    if(event.data.mode==='popup'){
      clearNotifications(false);
      pickerOpen=event.data.carriedPanel==='role';
      noteOpen=event.data.carriedPanel==='note';
      if(!pickerOpen)roleFilter='';
      if(!noteOpen){noteDraft='';noteLastValid='';}
    }else if(standaloneRole&&!wasStandaloneRole){pickerOpen=true;noteOpen=false;selectedRoleIndex=0;}
    else if(standaloneNote&&!wasStandaloneNote){noteOpen=true;pickerOpen=false;noteDraft='';noteLastValid='';}
    if(latestData)renderMembers();
  }
});
document.addEventListener('pointerdown',event=>{if(pickerOpen&&!event.target.closest('.role-picker,.role-trigger'))closeRolePicker();if(noteOpen&&!event.target.closest('.note-editor,.note-trigger'))closeNoteEditor()});

function storageCall(method,value){return new Promise((resolve,reject)=>{try{chrome.storage.local[method](value,result=>{try{const failure=chrome.runtime.lastError;if(failure)reject(new Error(failure.message));else resolve(result)}catch(error){reject(error)}})}catch(error){reject(error)}})}
const storage={get:key=>storageCall('get',key),set:value=>storageCall('set',value),remove:key=>storageCall('remove',key)};
function measuredHeight(){const base=document.querySelector('header').offsetHeight+app.scrollHeight;return Math.max(base,pickerDesiredHeight)}
function reportSize(){window.parent.postMessage({type:'quadruzz-resize',height:measuredHeight()},'*')}
function reportReady(){const height=measuredHeight();window.parent.postMessage({type:'quadruzz-picker-visibility',visible:pickerOpen||noteOpen},'*');window.parent.postMessage({type:'quadruzz-ready',presentationId,height},'*')}
async function api(path,options={}){const{token}=await storage.get('token');const headers={...options.headers,...(token&&{authorization:`Bearer ${token}`})};const response=await fetch(`${BASE}${path}`,{...options,headers});if(response.status===401)await storage.remove('token');return response}
async function pulseActivity(){try{const stored=await storage.get(['token','extensionActivitySessionId','extensionActivityPulseAt']);if(!stored.token)return;const now=Date.now();if(now-(stored.extensionActivityPulseAt||0)<15000)return;const extensionSessionId=stored.extensionActivitySessionId||crypto.randomUUID();await storage.set({extensionActivitySessionId,extensionActivityPulseAt:now});const response=await fetch(`${BASE}/api/extension`,{method:'POST',headers:{authorization:`Bearer ${stored.token}`,'content-type':'application/json'},body:JSON.stringify({extensionAction:'heartbeat',extensionSessionId})});if(response.status===401)await storage.remove(['token','extensionActivityPulseAt']);else if(!response.ok)await storage.remove('extensionActivityPulseAt')}catch(error){if(!stopInvalidContext(error))try{await storage.remove('extensionActivityPulseAt')}catch{/* The next member refresh retries. */}}}
function requireFullPopup(){if(standaloneRole||standaloneNote)window.parent.postMessage({type:'quadruzz-require-popup'},'*')}
function connectingView(){requireFullPopup();app.innerHTML='<div class="connect"><button class="primary" disabled>Connecting to Cross…</button></div>';reportReady()}
function waitingView(){requireFullPopup();app.innerHTML='<div class="connect"><button class="primary" id="open-hq">Waiting for approval</button></div>';document.querySelector('#open-hq').addEventListener('click',()=>chrome.runtime.sendMessage({type:'quadruzz-open-hq'}));reportReady()}
function signInView(){requireFullPopup();app.innerHTML='<div class="connect"><button class="primary" id="sign-in">Connect to Cross</button></div>';document.querySelector('#sign-in').addEventListener('click',signIn);reportReady()}
async function signIn(){connectingView();try{await chrome.runtime.sendMessage({type:'quadruzz-connect'})}catch{signInView()}}
async function connectionPending(){try{return Boolean((await chrome.runtime.sendMessage({type:'quadruzz-connect-state'}))?.connecting)}catch{return false}}
async function memberImage(member,token){const key=`${member.userId}:${member.imageVersion}`;if(imageUrls.has(key))return imageUrls.get(key);const response=await fetch(`${BASE}/api/extension/profile-image?user=${encodeURIComponent(member.userId)}&v=${member.imageVersion}`,{headers:{authorization:`Bearer ${token}`}});if(!response.ok)return'';const url=URL.createObjectURL(await response.blob());imageUrls.set(key,url);return url}
function formatNoteTime(value){const date=new Date(Number(value));if(Number.isNaN(date.getTime()))return'';const now=new Date();const pad=number=>String(number).padStart(2,'0');return date.toDateString()===now.toDateString()?pad(date.getHours())+':'+pad(date.getMinutes()):pad(date.getMonth()+1)+'/'+pad(date.getDate())}
const noteMeasureContext=document.createElement('canvas').getContext('2d');
function noteUsesTwoLines(value){
  const note=String(value??'');
  if(note.includes('\n'))return true;
  if(!noteMeasureContext)return false;
  noteMeasureContext.font='500 10px system-ui';
  let line='';
  for(const character of note){
    const candidate=line+character;
    if(line&&noteMeasureContext.measureText(candidate).width>153)return true;
    line=candidate;
  }
  return false;
}
function esc(value){const node=document.createElement('span');node.textContent=value??'';return node.innerHTML}
function stopInvalidContext(error){if(!/extension context invalidated/i.test(String(error)))return false;stopped=true;if(refreshTimer)clearInterval(refreshTimer);return true}
function matchingRoles(){const query=roleFilter.trim().toLocaleLowerCase();return (latestData?.roleStatuses||[]).filter(role=>!query||role.toLocaleLowerCase().includes(query))}
function hideOverlayNow(){window.parent.postMessage({type:'quadruzz-hide-now'},'*')}
function closeRolePicker(){if(standaloneRole){hideOverlayNow();return}pickerOpen=false;roleFilter='';renderMembers()}
function closeNoteEditor(){if(standaloneNote){hideOverlayNow();return}noteOpen=false;noteDraft='';noteLastValid='';renderMembers()}
function preparePanel(panel){pendingPanel=panel;window.parent.postMessage({type:'quadruzz-prepare-picker'},'*')}
function requestRolePickerToggle(){if(pickerOpen){closeRolePicker();return}noteOpen=false;selectedRoleIndex=0;roleFilter='';if(standaloneRole){pickerOpen=true;renderMembers();return}preparePanel('role')}
function requestNoteToggle(){if(noteOpen){closeNoteEditor();return}pickerOpen=false;noteDraft='';noteLastValid='';if(standaloneNote){noteOpen=true;renderMembers();return}preparePanel('note')}
function viewSignature(){return JSON.stringify({members:latestData?.members,roles:latestData?.roleStatuses,images:latestImages,pendingRole,pendingNote,pendingNoteSet})}
function rolePickerMarkup(){
  const roles=matchingRoles();
  return `<div class="role-picker"><input class="role-input" id="role-filter" maxlength="30" value="${esc(roleFilter)}" aria-label="Find or create role status" placeholder="Alterar atribuição..." autocomplete="off" spellcheck="false"><div class="role-options">${roles.map((role,index)=>`<button class="role-option" data-index="${index}" type="button">${esc(role)}</button>`).join('')}</div></div>`;
}
function bindRolePicker(){
  if(!pickerOpen)return;
  const input=document.querySelector('#role-filter');
  const options=[...document.querySelectorAll('.role-option')];
  const normalizeSelection=()=>{
    if(!options.length)selectedRoleIndex=-1;
    else if(selectedRoleIndex>=options.length)selectedRoleIndex=0;
  };
  const paintSelection=()=>{
    normalizeSelection();
    input.classList.toggle('selected',selectedRoleIndex===-1);
    options.forEach((button,index)=>button.classList.toggle('selected',selectedRoleIndex===index));
  };
  input.addEventListener('input',event=>{
    roleFilter=event.target.value;
    selectedRoleIndex=matchingRoles().length?0:-1;
    renderMembers();
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      if(selectedRoleIndex>=0)void chooseRole(matchingRoles()[selectedRoleIndex],false);
      else void chooseRole(input.value,true);
      return;
    }
    if(event.key==='Escape'){event.preventDefault();closeRolePicker();return}
    if(event.key==='Tab'||event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(event.repeat)return;
      const backwards=event.shiftKey||event.key==='ArrowUp';
      const count=options.length;
      if(!count)selectedRoleIndex=-1;
      else if(backwards)selectedRoleIndex=selectedRoleIndex===-1?count-1:selectedRoleIndex===0?-1:selectedRoleIndex-1;
      else selectedRoleIndex=selectedRoleIndex===-1?0:selectedRoleIndex===count-1?-1:selectedRoleIndex+1;
      paintSelection();
    }
  });
  options.forEach((button,index)=>{
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      event.stopPropagation();
      selectedRoleIndex=index;
      void chooseRole(matchingRoles()[index],false);
    });
  });
  paintSelection();
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
}
function noteEditorMarkup(){return `<div class="note-editor"><textarea id="note-input" rows="2" aria-label="Set note" placeholder="Enviar comunicado..." spellcheck="true">${esc(noteDraft)}</textarea></div>`}
function sizeNoteEditor(input){
  const editor=input.closest('.note-editor');
  input.style.height='18px';
  const required=input.scrollHeight;
  if(required>28)return false;
  const height=required>18?28:18;
  input.style.height=height+'px';
  editor.style.height=height+'px';
  const top=Number(editor.dataset.top||0);
  pickerDesiredHeight=top+height;
  reportSize();
  return true;
}
function bindNoteEditor(){
  if(!noteOpen)return;
  const input=document.querySelector('#note-input');
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void saveNote();return}
    if(event.key==='Escape'){event.preventDefault();closeNoteEditor()}
  });
  input.addEventListener('input',()=>{
    if(sizeNoteEditor(input)){noteDraft=input.value;noteLastValid=input.value;return}
    const caret=Math.min(input.selectionStart,noteLastValid.length);
    input.value=noteLastValid;
    noteDraft=noteLastValid;
    sizeNoteEditor(input);
    input.setSelectionRange(caret,caret);
  });
  sizeNoteEditor(input);
  input.focus();
  input.setSelectionRange(input.value.length,input.value.length);
}async function saveNote(value=noteDraft){
  if(savingNote)return;
  const note=String(value).trim().replace(/\r\n?/g,'\n')||null;
  savingNote=true;
  pendingNote=note;
  pendingNoteSet=true;
  const self=latestData?.members.find(member=>member.userId===latestData.currentUserId);
  const previous=self?.note??null;
  const previousUpdatedAt=self?.noteUpdatedAt??null;
  if(self){self.note=note;self.noteUpdatedAt=Date.now();pendingNoteUpdatedAt=self.noteUpdatedAt;}
  const closingStandalone=standaloneNote;
  noteOpen=false;
  noteDraft='';
  noteLastValid='';
  if(closingStandalone)hideOverlayNow();else renderMembers();
  try{
    const response=await api('/api/extension',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({note})});
    if(!response.ok)throw new Error();
    const result=await response.json();
    const savedNote=Object.prototype.hasOwnProperty.call(result,'note')?(result.note??null):note;
    if(self){self.note=savedNote;self.noteUpdatedAt=result.noteUpdatedAt??pendingNoteUpdatedAt;}
    pendingNote=savedNote;
    pendingNoteUpdatedAt=result.noteUpdatedAt??pendingNoteUpdatedAt;
    await loadMembers(true);
  }catch(error){
    if(stopInvalidContext(error))return;
    pendingNoteSet=false;
    pendingNote=null;
    if(self){self.note=previous;self.noteUpdatedAt=previousUpdatedAt;}
    void loadMembers(true);
  }finally{savingNote=false;renderMembers()}
}

function layoutRoleLabels(){
  if(roleLayoutFrame!==null)cancelAnimationFrame(roleLayoutFrame);
  roleLayoutFrame=requestAnimationFrame(()=>{
    roleLayoutFrame=null;
    document.querySelectorAll('.member').forEach(member=>{
      const label=member.querySelector('.role-label');
      const name=member.querySelector('.name-label');
      if(!label||!name)return;
      const overlap=Math.max(0,name.getBoundingClientRect().right-label.getBoundingClientRect().left+2);
      name.style.clipPath=overlap?`inset(0 ${overlap}px 0 0)`:'none';
    });
  });
}
new ResizeObserver(layoutRoleLabels).observe(document.documentElement);
function renderMembers(){
  if(!latestData)return;
  document.querySelectorAll('.role-picker,.note-editor,.note-notifications').forEach(element=>element.remove());
  const rows=latestData.members.map((member,index)=>{
    const self=member.userId===latestData.currentUserId;
    const role=`<span class="role-label">${esc(member.actingState)}</span>`;
    const name=self?`<button class="name own-zone note-trigger" type="button" aria-expanded="${noteOpen}"><span class="name-label">${esc(member.displayName)}</span></button>`:`<span class="name"><span class="name-label">${esc(member.displayName)}</span></span>`;
    const state=self?`<button class="state role-trigger" type="button" aria-expanded="${pickerOpen}">${role}</button>`:`<span class="state role-display">${role}</span>`;
    const twoLineNote=noteUsesTwoLines(member.note);
    const noteClass=`note-label${twoLineNote?' two-lines':''}${self?' own-note':''}`;
    const note=member.note?`${self?`<button class="${noteClass}" type="button" aria-label="Remove note">`:`<span class="${noteClass}">`}<span class="note-label-text">${esc(member.note)}</span><span class="note-label-meta">${self?'Remove':esc(formatNoteTime(member.noteUpdatedAt))}</span>${self?'</button>':'</span>'}`:'';
    return `<li class="member${member.extensionActive?'':' inactive'}${self?' self':''}${member.note?' has-note':''}${twoLineNote?' two-line-note':''}"><img src="${latestImages[index]||''}" alt="">${name}${state}${note}</li>`;
  }).join('');
  app.innerHTML=`<ul class="members">${rows}</ul>`;
  document.body.insertAdjacentHTML('beforeend',notificationMarkup());

  layoutRoleLabels();

  const ownNote=document.querySelector('.own-note');
  if(ownNote)ownNote.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();void saveNote('')});
  const roleTrigger=document.querySelector('.role-trigger');
  if(roleTrigger){
    roleTrigger.addEventListener('pointerdown',event=>{event.preventDefault();requestRolePickerToggle()});
    roleTrigger.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();requestRolePickerToggle()}});
  }
  const noteTrigger=document.querySelector('.note-trigger');
  if(noteTrigger){
    noteTrigger.addEventListener('pointerdown',event=>{event.preventDefault();requestNoteToggle()});
    noteTrigger.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();requestNoteToggle()}});
  }
  const notificationsHeight=notificationHeight();
  pickerDesiredHeight=notificationsHeight;
  if(pickerOpen&&roleTrigger){
    document.body.insertAdjacentHTML('beforeend',rolePickerMarkup());
    const picker=document.querySelector('.role-picker');
    const top=standaloneRole?notificationsHeight+(notificationsHeight?2:0):Math.round(roleTrigger.closest('.member').getBoundingClientRect().bottom)+2;
    picker.style.top=`${top}px`;
    picker.style.left=standaloneRole?'0':'48px';
    picker.style.width=standaloneRole?'100%':'161px';
    picker.style.maxHeight=`calc(100vh - ${top}px)`;
    pickerDesiredHeight=top+(matchingRoles().length+1)*24;
  }else if(noteOpen&&noteTrigger){
    document.body.insertAdjacentHTML('beforeend',noteEditorMarkup());
    const editor=document.querySelector('.note-editor');
    const top=standaloneNote?notificationsHeight+(notificationsHeight?2:0):Math.round(noteTrigger.closest('.member').getBoundingClientRect().bottom)+2;
    editor.style.top=`${top}px`;
    editor.style.left=standaloneNote?'0':'48px';
    editor.style.width=standaloneNote?'100%':'161px';
    editor.dataset.top=String(top);
    pickerDesiredHeight=top+18;
  }
  lastRenderSignature=viewSignature();
  bindRolePicker();
  bindNoteEditor();
  reportReady();
}async function chooseRole(value,create){
  const label=String(value||'').trim().replace(/\s+/g,' ');
  if(!label||label.length>30||savingRole)return;
  savingRole=true;
  pendingRole=label;
  const self=latestData?.members.find(member=>member.userId===latestData.currentUserId);
  const previous=self?.actingState;
  if(self)self.actingState=label;
  const closingStandalone=standaloneRole;
  pickerOpen=false;
  noteOpen=false;
  roleFilter='';
  if(closingStandalone)hideOverlayNow();else renderMembers();
  try{
    const response=await api('/api/extension',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actingState:label,createActingState:create})});
    if(!response.ok)throw new Error();
    const result=await response.json();
    if(self&&result.actingState){self.actingState=result.actingState;pendingRole=result.actingState}
    await loadMembers(true);
  }catch(error){
    if(stopInvalidContext(error))return;
    pendingRole=null;
    if(self)self.actingState=previous;
    void loadMembers(true);
  }finally{savingRole=false;renderMembers()}
}
async function loadMembers(forceRender=false){
  if(stopped)return;
  const sequence=++nextLoadSequence;
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
    if(sequence<appliedLoadSequence)return;
    appliedLoadSequence=sequence;
    const self=data.members.find(member=>member.userId===data.currentUserId);
    if(pendingRole){
      if(!savingRole&&self?.actingState===pendingRole)pendingRole=null;
      else if(self)self.actingState=pendingRole;
    }
    if(pendingNoteSet){
      if(!savingNote&&(self?.note??null)===pendingNote){pendingNoteSet=false;pendingNote=null;pendingNoteUpdatedAt=null}
      else if(self){self.note=pendingNote;self.noteUpdatedAt=pendingNoteUpdatedAt;}
    }
    detectNoteNotifications(data);
    latestData=data;
    latestImages=images;
    if(!pickerOpen&&!noteOpen&&(forceRender||viewSignature()!==lastRenderSignature))renderMembers();
  }catch(error){if(stopInvalidContext(error))return;reportReady()}
}
new ResizeObserver(reportSize).observe(document.body);
try{const started=chrome.runtime.sendMessage({type:'quadruzz-authenticated'});if(started?.catch)started.catch(()=>{})}catch{/* The background alarm will retry. */}
void loadMembers();
refreshTimer=setInterval(loadMembers,1000);
window.addEventListener('pagehide',()=>{stopped=true;if(refreshTimer)clearInterval(refreshTimer)});
