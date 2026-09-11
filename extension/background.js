const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const ACTIVITY_ALARM = 'cross-quadruzz-activity';

async function tell(tabId, type) {
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type }); } catch { /* Restricted or unloaded tab. */ }
}

async function getState() {
  const state = await chrome.storage.session.get(['overlayVisible', 'activeTabId']);
  return { visible: state.overlayVisible === true, activeTabId: state.activeTabId || null };
}

async function resetState() { await chrome.storage.session.set({ overlayVisible: false, activeTabId: null }); }

async function synchronizeActivity() {
  try {
    const stored = await chrome.storage.local.get(['token', 'extensionActivitySessionId']);
    if (!stored.token) return;
    const extensionSessionId = stored.extensionActivitySessionId || crypto.randomUUID();
    if (!stored.extensionActivitySessionId) await chrome.storage.local.set({ extensionActivitySessionId });
    const response = await fetch(`${BASE}/api/extension`, {
      method: 'POST',
      headers: { authorization: `Bearer ${stored.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ extensionAction: 'heartbeat', extensionSessionId }),
    });
    if (response.status === 401) await chrome.storage.local.remove('token');
  } catch { /* The next alarm retries transient browser or network failures. */ }
}

async function startActivityHeartbeat() {
  await chrome.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 0.5 });
  await synchronizeActivity();
}

async function toggle(tab) {
  const state = await getState();
  const visible = !state.visible;
  const activeTabId = tab?.id || state.activeTabId;
  await chrome.storage.session.set({ overlayVisible: visible, activeTabId });
  await tell(activeTabId, visible ? 'quadruzz-show' : 'quadruzz-hide');
}

chrome.runtime.onStartup.addListener(() => { void resetState(); void startActivityHeartbeat(); });
chrome.runtime.onInstalled.addListener(() => { void resetState(); void startActivityHeartbeat(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ACTIVITY_ALARM) void synchronizeActivity(); });
chrome.action.onClicked.addListener(toggle);
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  await chrome.storage.session.set({ activeTabId: tabId });
  if (!state.visible) return;
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tabId, 'quadruzz-show');
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const state = await getState();
  if (!state.visible) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (!tab?.id || tab.id === state.activeTabId) return;
  await chrome.storage.session.set({ activeTabId: tab.id });
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tab.id, 'quadruzz-show');
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = await getState();
  if (state.visible && tab.active && changeInfo.status === 'complete') await tell(tabId, 'quadruzz-show');
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'quadruzz-authenticated') void synchronizeActivity();
  if (message?.type === 'quadruzz-toggle') void toggle(sender.tab);
  if (message?.type === 'quadruzz-close') {
    void chrome.storage.session.set({ overlayVisible: false });
    void tell(sender.tab?.id, 'quadruzz-hide');
  }
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

void startActivityHeartbeat();
