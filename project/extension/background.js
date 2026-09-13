const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const ACTIVITY_ALARM = 'cross-quadruzz-activity';
const CONNECT_TAB_KEY = 'connectTabId';
const seenNoteNotifications = new Map();

async function tell(tabId, type, mode, panel = null) {
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type, mode, panel }); } catch { /* Restricted or unloaded tab. */ }
}

async function broadcast(type) {
  try { await chrome.runtime.sendMessage({ type }); } catch { /* No visible overlay is listening. */ }
}

async function getState() {
  const state = await chrome.storage.session.get(['overlayMode', 'activeTabId']);
  return { mode: state.overlayMode || 'hidden', activeTabId: state.activeTabId || null };
}

async function resetState() { await chrome.storage.session.set({ overlayMode: 'hidden', activeTabId: null }); }

async function deliverNoteNotification(notification) {
  if (!notification?.userId || !notification?.note || !notification?.noteUpdatedAt) return;
  const key = `${notification.userId}:${notification.noteUpdatedAt}`;
  const now = Date.now();
  for (const [seenKey, seenAt] of seenNoteNotifications) if (now - seenAt > 10000) seenNoteNotifications.delete(seenKey);
  if (seenNoteNotifications.has(key)) return;
  seenNoteNotifications.set(key, now);
  const state = await getState();
  if (state.mode === 'popup') return;
  let tabId = state.activeTabId;
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tabId = tab?.id;
  }
  await tell(tabId, 'quadruzz-note-notification', undefined, notification);
}

async function clearNoteNotifications(tabId) {
  await tell(tabId, 'quadruzz-clear-notifications');
}

function connectionCallbackUrl() { return `https://${chrome.runtime.id}.chromiumapp.org/quadruzz`; }

async function openConnectionTab() {
  await broadcast('quadruzz-connect-started');
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId) {
    try {
      const existing = await chrome.tabs.get(stored.connectTabId);
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
      return;
    } catch { await chrome.storage.session.remove(CONNECT_TAB_KEY); }
  }
  const redirectUrl = connectionCallbackUrl();
  const tab = await chrome.tabs.create({ url: `${BASE}/extension/authorize?redirect_uri=${encodeURIComponent(redirectUrl)}`, active: true });
  if (tab.id) await chrome.storage.session.set({ connectTabId: tab.id });
}

async function completeConnection(tabId, url) {
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId !== tabId || !url.startsWith(connectionCallbackUrl())) return false;
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get('token');
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  if (token) {
    await chrome.storage.local.set({ token });
    await startActivityHeartbeat();
  }
  try { await chrome.tabs.remove(tabId); } catch { /* The connection tab may already be closing. */ }
  try { await chrome.runtime.sendMessage({ type: token ? 'quadruzz-connect-complete' : 'quadruzz-connect-cancelled' }); } catch { /* No visible overlay is listening. */ }
  return true;
}

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
  await synchronizeActivity();
  try { await chrome.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 0.5 }); }
  catch { await chrome.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 1 }); }
}

async function toggle(tab) {
  const state = await getState();
  const mode = state.mode === 'popup' ? 'hidden' : 'popup';
  const activeTabId = tab?.id || state.activeTabId;
  await chrome.storage.session.set({ overlayMode: mode, activeTabId });
  const panel = mode === 'popup' && (state.mode === 'role' || state.mode === 'note') ? state.mode : null;
  if (mode === 'popup') await clearNoteNotifications(activeTabId);
  await tell(activeTabId, mode === 'hidden' ? 'quadruzz-hide' : 'quadruzz-show', mode, panel);
}

async function togglePanel(tab, panel) {
  const state = await getState();
  const activeTabId = tab?.id || state.activeTabId;
  if (state.mode === 'popup') {
    await tell(activeTabId, panel === 'role' ? 'quadruzz-role-toggle-open' : 'quadruzz-note-toggle-open');
    return;
  }
  const mode = state.mode === panel ? 'hidden' : panel;
  await chrome.storage.session.set({ overlayMode: mode, activeTabId });
  await tell(activeTabId, mode === 'hidden' ? 'quadruzz-hide' : 'quadruzz-show', mode);
}

const toggleRole = (tab) => togglePanel(tab, 'role');
const toggleNote = (tab) => togglePanel(tab, 'note');

chrome.runtime.onStartup.addListener(() => { void resetState(); void startActivityHeartbeat(); });
chrome.runtime.onInstalled.addListener(() => { void resetState(); void startActivityHeartbeat(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ACTIVITY_ALARM) void synchronizeActivity(); });
chrome.action.onClicked.addListener(toggle);
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  await chrome.storage.session.set({ activeTabId: tabId });
  if (state.mode === 'hidden') return;
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tabId, 'quadruzz-show', state.mode);
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const state = await getState();
  if (state.mode === 'hidden') return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (!tab?.id || tab.id === state.activeTabId) return;
  await chrome.storage.session.set({ activeTabId: tab.id });
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tab.id, 'quadruzz-show', state.mode);
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const destination = changeInfo.url || tab.url;
  if (destination && await completeConnection(tabId, destination)) return;
  const state = await getState();
  if (state.mode !== 'hidden' && tab.active && changeInfo.status === 'complete') await tell(tabId, 'quadruzz-show', state.mode);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId !== tabId) return;
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  try { await chrome.runtime.sendMessage({ type: 'quadruzz-connect-cancelled' }); } catch { /* No visible overlay is listening. */ }
});
let lastShortcutType = '';
let lastShortcutAt = 0;
function acceptShortcut(type) { const now = Date.now(); if (type === lastShortcutType && now - lastShortcutAt < 180) return false; lastShortcutType = type; lastShortcutAt = now; return true; }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'quadruzz-open-hq') void chrome.tabs.create({ url: BASE, active: true });
  if (message?.type === 'quadruzz-connect') void openConnectionTab().catch(() => broadcast('quadruzz-connect-cancelled'));
  if (message?.type === 'quadruzz-connect-state') {
    void chrome.storage.session.get(CONNECT_TAB_KEY).then((stored) => sendResponse({ connecting: Boolean(stored.connectTabId) }));
    return true;
  }
  if (message?.type === 'quadruzz-account-changing') {
    void chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt']).then(() => broadcast('quadruzz-connect-cancelled'));
  }
  if (message?.type === 'quadruzz-authenticated') void synchronizeActivity();
  if (message?.type === 'quadruzz-note-notification') void deliverNoteNotification(message.notification);
  if (message?.type === 'quadruzz-toggle' && acceptShortcut(message.type)) void toggle(sender.tab);
  if (message?.type === 'quadruzz-role-toggle' && acceptShortcut(message.type)) void toggleRole(sender.tab);
  if (message?.type === 'quadruzz-note-toggle' && acceptShortcut(message.type)) void toggleNote(sender.tab);
  if (message?.type === 'quadruzz-force-popup') {
    void chrome.storage.session.set({ overlayMode: 'popup', activeTabId: sender.tab?.id }).then(() => tell(sender.tab?.id, 'quadruzz-show', 'popup'));
  }
  if (message?.type === 'quadruzz-close') {
    void chrome.storage.session.set({ overlayMode: 'hidden' });
    void tell(sender.tab?.id, 'quadruzz-hide');
  }
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

void startActivityHeartbeat();
