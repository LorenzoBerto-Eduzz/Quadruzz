const FRAME_ID = 'cross-quadruzz-overlay';
let revealRequested = false;
let requestedMode = 'popup';
let frameReady = false;

function styleFrame(frame, mode) {
  const roleOnly = mode === 'role';
  frame.style.width = roleOnly ? '177px' : '216px';
  frame.style.borderRadius = roleOnly ? '2px' : '9px';
}

function notifyMode(frame) { frame.contentWindow?.postMessage({ type: 'quadruzz-overlay-mode', mode: requestedMode }, '*'); }

function ensureFrame() {
  let frame = document.getElementById(FRAME_ID);
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.src = chrome.runtime.getURL('popup.html');
    frame.title = 'Cross-Quadruzz';
    Object.assign(frame.style, { position: 'fixed', top: '3px', right: '72px', width: '216px', height: '96px', maxHeight: 'calc(100vh - 6px)', border: '0', borderRadius: '9px', zIndex: '2147483647', boxShadow: '0 14px 38px rgba(0,0,0,.4)', colorScheme: 'dark', display: 'none' });
    (document.body || document.documentElement).append(frame);
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === 'quadruzz-resize') frame.style.height = `${Math.min(window.innerHeight - 6, Math.max(24, event.data.height))}px`;
      if (event.data?.type === 'quadruzz-require-popup') {
        try { chrome.runtime.sendMessage({ type: 'quadruzz-force-popup' }).catch(() => {}); } catch {}
      }
      if (event.data?.type === 'quadruzz-ready') {
        frameReady = true;
        notifyMode(frame);
        if (revealRequested) frame.style.display = 'block';
      }
    });
  }
  return frame;
}

function show(mode = 'popup') {
  revealRequested = true;
  requestedMode = mode;
  const frame = ensureFrame();
  styleFrame(frame, mode);
  notifyMode(frame);
  if (frameReady) frame.style.display = 'block';
}

function hide() {
  revealRequested = false;
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.display = 'none';
}
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'quadruzz-show') show(message.mode);
  if (message?.type === 'quadruzz-hide') hide();
  if (message?.type === 'quadruzz-role-toggle-open') document.getElementById(FRAME_ID)?.contentWindow?.postMessage({ type: 'quadruzz-role-toggle' }, '*');
});

window.addEventListener('message', (event) => {
  if (location.origin !== 'https://cross-quadruzz.l-busslerberto.chatgpt.site' || event.source !== window || event.origin !== location.origin || event.data?.type !== 'quadruzz-account-changing') return;
  try {
    const sent = chrome.runtime.sendMessage({ type: 'quadruzz-account-changing' });
    if (sent?.catch) sent.catch(() => {});
  } catch { /* Extension was reloaded while this page remained open. */ }
});

document.addEventListener('pointerdown', (event) => {
  const frame = document.getElementById(FRAME_ID);
  if (frame?.style.display === 'block' && event.target !== frame) {
    frame.contentWindow?.postMessage({ type: 'quadruzz-dismiss-menus' }, '*');
  }
}, true);
window.addEventListener('keydown', (event) => {
  const popupToggle = event.code === 'KeyW' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
  const roleToggle = event.code === 'KeyD' && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  if (event.repeat || (!popupToggle && !roleToggle)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const sent = chrome.runtime.sendMessage({ type: popupToggle ? 'quadruzz-toggle' : 'quadruzz-role-toggle' });
    if (sent?.catch) sent.catch(() => {});
  } catch { /* Extension was reloaded while this page remained open. */ }
}, true);

ensureFrame();
