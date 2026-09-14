const FRAME_ID = 'cross-quadruzz-overlay';
let revealRequested = false;
let requestedMode = 'popup';
let frameReady = false;
let presentationId = 0;
let carriedPanel = null;
let revealFrame = null;

function styleFrame(frame, mode) {
  const roleOnly = mode === 'role';
  const noteOnly = mode === 'note';
  const notificationOnly = mode === 'notification';
  frame.style.width = roleOnly || noteOnly || notificationOnly ? '193px' : '248px';
  frame.style.right = roleOnly || noteOnly || notificationOnly ? '79px' : '72px';
  frame.style.borderRadius = roleOnly || noteOnly || notificationOnly ? '2px' : '9px';
  frame.style.boxShadow = 'none';
  frame.style.zoom = '1.1';
  frame.style.transform = 'none';
}

function notifyMode(frame) { frame.contentWindow?.postMessage({ type: 'quadruzz-overlay-mode', mode: requestedMode, visible: revealRequested, presentationId, carriedPanel }, '*'); }

function ensureFrame() {
  let frame = document.getElementById(FRAME_ID);
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.src = chrome.runtime.getURL('popup.html');
    frame.title = 'Cross-Quadruzz';
    Object.assign(frame.style, { position: 'fixed', top: '3px', right: '72px', width: '248px', height: '96px', maxHeight: 'calc(100vh - 6px)', border: '0', borderRadius: '9px', zIndex: '2147483647', boxShadow: 'none', zoom: '1.1', transform: 'none', colorScheme: 'dark', visibility: 'hidden', opacity: '0', pointerEvents: 'none', transition: 'none', display: 'block' });
    (document.body || document.documentElement).append(frame);
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === 'quadruzz-resize') frame.style.height = `${Math.min(window.innerHeight - 6, Math.max(24, event.data.height))}px`;
      if (event.data?.type === 'quadruzz-prepare-picker') {
        frame.style.height = `${window.innerHeight - 6}px`;
        frame.contentWindow?.postMessage({ type: 'quadruzz-picker-prepared' }, '*');
      }
      if (event.data?.type === 'quadruzz-hide-now') {
        hide();
        try { chrome.runtime.sendMessage({ type: 'quadruzz-close' }).catch(() => {}); } catch {}
      }
      if (event.data?.type === 'quadruzz-require-popup') {
        try { chrome.runtime.sendMessage({ type: 'quadruzz-force-popup' }).catch(() => {}); } catch {}
      }
      if (event.data?.type === 'quadruzz-ready') {
        const firstReady = !frameReady;
        frameReady = true;
        if (firstReady) { notifyMode(frame); return; }
        if (event.data.presentationId !== presentationId) return;
        if (revealRequested) {
          const readyPresentationId = presentationId;
          const readyHeight = Number(event.data.height);
          if (Number.isFinite(readyHeight)) {
            frame.style.height = `${Math.min(window.innerHeight - 6, Math.max(24, readyHeight))}px`;
          }
          if (revealFrame !== null) cancelAnimationFrame(revealFrame);
          revealFrame = requestAnimationFrame(() => {
            if (!revealRequested || readyPresentationId !== presentationId) { revealFrame = null; return; }
            revealFrame = requestAnimationFrame(() => {
              revealFrame = null;
              if (!revealRequested || readyPresentationId !== presentationId) return;
              frame.style.display = 'block';
              frame.style.visibility = 'visible';
              frame.style.opacity = '1';
              frame.style.pointerEvents = 'auto';
              const needsInputFocus =
                requestedMode === 'role' ||
                requestedMode === 'note' ||
                carriedPanel === 'role' ||
                carriedPanel === 'note';
              if (needsInputFocus) {
                frame.focus({ preventScroll: true });
                frame.contentWindow?.postMessage({ type: 'quadruzz-presented', presentationId }, '*');
              }
            });
          });
        }
      }
    });
  }
  return frame;
}

function show(mode = 'popup', panel = null) {
  presentationId += 1;
  if (revealFrame !== null) cancelAnimationFrame(revealFrame);
  revealFrame = null;
  const currentPresentationId = presentationId;
  revealRequested = true;
  requestedMode = mode;
  carriedPanel = panel;
  const frame = ensureFrame();
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  frame.style.visibility = 'hidden';
  frame.style.display = 'block';
  styleFrame(frame, mode);
  if (mode === 'role' || mode === 'note' || panel === 'role' || panel === 'note') {
    frame.style.height = `${window.innerHeight - 6}px`;
  }
  if (currentPresentationId === presentationId && revealRequested) notifyMode(frame);
}

function suspend() {
  presentationId += 1;
  revealRequested = false;
  if (revealFrame !== null) cancelAnimationFrame(revealFrame);
  revealFrame = null;
  const frame = document.getElementById(FRAME_ID);
  if (!frame) return;
  frame.contentWindow?.postMessage({ type: 'quadruzz-transfer-suspend' }, '*');
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  frame.style.visibility = 'hidden';
  frame.style.display = 'block';
}
function hide() {
  presentationId += 1;
  revealRequested = false;
  requestedMode = 'hidden';
  carriedPanel = null;
  if (revealFrame !== null) cancelAnimationFrame(revealFrame);
  revealFrame = null;
  const frame = document.getElementById(FRAME_ID);
  if (frame) {
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    frame.style.visibility = 'hidden';
    frame.style.display = 'block';
    frame.blur();
    window.focus();
    frame.contentWindow?.postMessage({ type: 'quadruzz-overlay-hidden' }, '*');
  }
}
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'quadruzz-show') show(message.mode, message.panel);
  if (message?.type === 'quadruzz-suspend') suspend();
  if (message?.type === 'quadruzz-hide') hide();
  if (message?.type === 'quadruzz-role-toggle-open') document.getElementById(FRAME_ID)?.contentWindow?.postMessage({ type: 'quadruzz-role-toggle' }, '*');
  if (message?.type === 'quadruzz-note-toggle-open') document.getElementById(FRAME_ID)?.contentWindow?.postMessage({ type: 'quadruzz-note-toggle' }, '*');
  if (message?.type === 'quadruzz-clear-notifications') document.getElementById(FRAME_ID)?.contentWindow?.postMessage({ type: 'quadruzz-clear-notifications' }, '*');
  if (message?.type === 'quadruzz-note-notification') {
    const frame = ensureFrame();
    if (revealRequested && requestedMode === 'popup') return;
    if (!revealRequested) show('notification');
    frame.contentWindow?.postMessage({ type: 'quadruzz-note-notification', notification: message.panel }, '*');
  }
});

window.addEventListener('message', (event) => {
  const messageType = event.data?.type;
  if (location.origin !== 'https://cross-quadruzz.l-busslerberto.chatgpt.site' || event.source !== window || event.origin !== location.origin || !['quadruzz-account-changing', 'quadruzz-access-requested'].includes(messageType)) return;
  try {
    const sent = chrome.runtime.sendMessage({ type: messageType });
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
  const roleToggle = event.code === 'KeyD' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
  const noteToggle = event.code === 'KeyS' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
  if (event.repeat || (!popupToggle && !roleToggle && !noteToggle)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const type = popupToggle ? 'quadruzz-toggle' : roleToggle ? 'quadruzz-role-toggle' : 'quadruzz-note-toggle';
    const sent = chrome.runtime.sendMessage({ type });
    if (sent?.catch) sent.catch(() => {});
  } catch { /* Extension was reloaded while this page remained open. */ }
}, true);

ensureFrame();
