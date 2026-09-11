const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const PRESENCE_ALARM = 'cross-quadruzz-presence';

async function tell(tabId, type) {
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type }); } catch { /* Restricted or unloaded tab. */ }
}

async function getState() {
  const state = await chrome.storage.session.get(['overlayVisible', 'activeTabId']);
  return { visible: state.overlayVisible === true, activeTabId: state.activeTabId || null };
}

async function resetState() { await chrome.storage.session.set({ overlayVisible: false, activeTabId: null }); }

async function synchronizePresence() {
  try {
    const stored = await chrome.storage.local.get(['token', 'presenceWatchdogSessionId']);
    if (!stored.token) return;
    let sessionId = stored.presenceWatchdogSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await chrome.storage.local.set({ presenceWatchdogSessionId: sessionId });
    }
    const tabs = await chrome.tabs.query({ url: `${BASE}/*` });
    const pageOpen = tabs.length > 0;
    const previous = await chrome.storage.session.get('presenceWatchdogPageOpen');
    if (!pageOpen && previous.presenceWatchdogPageOpen === false) return;
    const response = await fetch(`${BASE}/api/extension`, {
      method: 'POST',
      headers: { authorization: `Bearer ${stored.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ presenceAction: pageOpen ? 'heartbeat' : 'leave', presenceSessionId: sessionId }),
    });
    if (response.status === 401) await chrome.storage.local.remove('token');
    if (response.ok) await chrome.storage.session.set({ presenceWatchdogPageOpen: pageOpen });
  } catch { /* The next alarm retries transient browser or network failures. */ }
}

async function startPresenceWatchdog() {
  await chrome.alarms.create(PRESENCE_ALARM, { periodInMinutes: 0.5 });
  await synchronizePresence();
}

async function toggle(tab) {
  const state = await getState();
  const visible = !state.visible;
  const activeTabId = tab?.id || state.activeTabId;
  await chrome.storage.session.set({ overlayVisible: visible, activeTabId });
  await tell(activeTabId, visible ? 'quadruzz-show' : 'quadruzz-hide');
}

chrome.runtime.onStartup.addListener(() => { void resetState(); void startPresenceWatchdog(); });
chrome.runtime.onInstalled.addListener(() => { void resetState(); void startPresenceWatchdog(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === PRESENCE_ALARM) void synchronizePresence(); });
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
  if (changeInfo.url || changeInfo.status === 'complete') void synchronizePresence();
});
chrome.tabs.onRemoved.addListener(() => { void synchronizePresence(); });
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'quadruzz-toggle') void toggle(sender.tab);
  if (message?.type === 'quadruzz-close') {
    void chrome.storage.session.set({ overlayVisible: false });
    void tell(sender.tab?.id, 'quadruzz-hide');
  }
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

void startPresenceWatchdog();
