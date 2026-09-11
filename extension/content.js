const FRAME_ID = 'cross-quadruzz-overlay';

function show() {
  let frame = document.getElementById(FRAME_ID);
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.src = chrome.runtime.getURL('popup.html');
    frame.title = 'Cross-Quadruzz';
    Object.assign(frame.style, { position: 'fixed', top: '12px', right: '12px', width: '370px', height: '560px', maxHeight: 'calc(100vh - 24px)', border: '0', borderRadius: '12px', zIndex: '2147483647', boxShadow: '0 16px 48px rgba(0,0,0,.38)', colorScheme: 'dark' });
    document.documentElement.append(frame);
  }
  frame.style.display = 'block';
}

function hide() { const frame = document.getElementById(FRAME_ID); if (frame) frame.style.display = 'none'; }
chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'quadruzz-show') show(); if (message?.type === 'quadruzz-hide') hide(); });
