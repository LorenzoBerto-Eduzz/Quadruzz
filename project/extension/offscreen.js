const worker = new Worker('sync-worker.js');
let extensionVersion = null;

function sendToken(token, version = extensionVersion) {
  extensionVersion = version || extensionVersion;
  worker.postMessage({ type: 'quadruzz-token', token: token || null, extensionVersion });
}

worker.addEventListener('message', (event) => {
  try {
    const sent = chrome.runtime.sendMessage(event.data);
    if (sent?.catch) sent.catch(() => {});
  } catch { /* The service worker wakes on the next synchronization message. */ }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'quadruzz-offscreen-token') sendToken(message.token, message.extensionVersion);
});

void chrome.runtime.sendMessage({ type: 'quadruzz-offscreen-token-request' })
  .then((response) => sendToken(response?.token, response?.extensionVersion))
  .catch(() => sendToken(null));
