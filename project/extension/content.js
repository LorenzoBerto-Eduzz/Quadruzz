const FRAME_ID = 'cross-quadruzz-overlay';
let revealRequested = false;
let frameReady = false;

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
      if (event.data?.type === 'quadruzz-resize') frame.style.height = `${Math.min(window.innerHeight - 6, Math.max(44, event.data.height))}px`;
      if (event.data?.type === 'quadruzz-ready') {
        frameReady = true;
        if (revealRequested) frame.style.display = 'block';
      }
    });
  }
  return frame;
}

function show() {
  revealRequested = true;
  const frame = ensureFrame();
  if (frameReady) frame.style.display = 'block';
}

function hide() {
  revealRequested = false;
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.display = 'none';
}
chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'quadruzz-show') show(); if (message?.type === 'quadruzz-hide') hide(); });

window.addEventListener('message', (event) => {
  if (location.origin !== 'https://cross-quadruzz.l-busslerberto.chatgpt.site' || event.source !== window || event.origin !== location.origin || event.data?.type !== 'quadruzz-account-changing') return;
  try {
    const sent = chrome.runtime.sendMessage({ type: 'quadruzz-account-changing' });
    if (sent?.catch) sent.catch(() => {});
  } catch { /* Extension was reloaded while this page remained open. */ }
});

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.code !== 'KeyW' || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const sent = chrome.runtime.sendMessage({ type: 'quadruzz-toggle' });
    if (sent?.catch) sent.catch(() => {});
  } catch { /* Extension was reloaded while this page remained open. */ }
}, true);

ensureFrame();
