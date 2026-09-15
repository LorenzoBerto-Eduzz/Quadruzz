const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const ACTIVITY_ALARM = 'cross-quadruzz-activity';
const CONNECT_TAB_KEY = 'connectTabId';
const OFFSCREEN_URL = 'offscreen.html';
const ACTION_POPUP = 'popup.html';
const ACTION_NOTIFICATION_KEY = 'actionPopupNotification';
const seenNoteNotifications = new Map();
let actionPopupPort = null;
let actionPopupVisible = false;
let actionPopupMode = 'popup';
let actionNotificationSequence = 0;
const pendingActionNotifications = new Map();
let cachedAccessState = 'unknown';
let cachedAccessAt = 0;
const ACCESS_CACHE_MS = 3000;
let connectionOpening = null;
let overlayOperation = Promise.resolve();
function queueOverlay(operation) { overlayOperation = overlayOperation.then(operation, operation); return overlayOperation; }

function isInjectableTab(tab) { return Boolean(tab?.id && /^https?:\/\//i.test(tab.url || '')); }

async function tell(tabId, type, mode, panel = null, allowInjection = true) {
  if (!tabId) return false;
  const message = { type, mode, panel };
  try { await chrome.tabs.sendMessage(tabId, message); return true; }
  catch {
    if (!allowInjection) return false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!isInjectableTab(tab)) return false;
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch { return false; }
  }
}
async function broadcast(type) {
  try { await chrome.runtime.sendMessage({ type }); } catch { /* No visible overlay is listening. */ }
}

let offscreenCreating = null;
async function ensureOffscreen() {
  if (offscreenCreating) return offscreenCreating;
  offscreenCreating = (async () => {
    const url = chrome.runtime.getURL(OFFSCREEN_URL);
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (contexts.length) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['WORKERS'],
      justification: 'Maintain one centralized worker for team presence and note notifications while Chrome is open.',
    });
  })();
  try { await offscreenCreating; } catch { /* Startup and alarm events retry creation. */ }
  finally { offscreenCreating = null; }
}

async function sendOffscreenToken() {
  const { token = null } = await chrome.storage.local.get('token');
  try { await chrome.runtime.sendMessage({ type: 'quadruzz-offscreen-token', token }); }
  catch { /* The offscreen document requests the current token when it starts. */ }
}

async function configureActionPopup(tab) {
  if (!tab?.id) return;
  try {
    await chrome.action.enable(tab.id);
    await chrome.action.setPopup({ tabId: tab.id, popup: isInjectableTab(tab) ? '' : ACTION_POPUP });
  }
  catch { /* Tabs may close while their action state is being configured. */ }
}
async function configureOpenActionPopups() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(configureActionPopup));
}
async function openActionPopup(tab, panel = 'popup') {
  if (!tab?.id) return false;
  const targetWindow = tab.windowId ? await chrome.windows.get(tab.windowId).catch(() => null) : null;
  if (!targetWindow?.focused) return false;
  const state = await getState();
  if (state.mode !== 'hidden') {
    await tell(state.activeTabId, 'quadruzz-hide');
    await chrome.storage.session.set({ overlayMode: 'hidden', activeTabId: null });
  }
  await chrome.action.setPopup({ tabId: tab.id, popup: `popup.html?action=${panel}` });
  try {
    await chrome.action.openPopup({ windowId: tab.windowId });
    return true;
  } catch { return false; }
  finally { await chrome.action.setPopup({ tabId: tab.id, popup: ACTION_POPUP }); }
}
async function toggleForTab(tab) {
  if (isInjectableTab(tab)) await toggle(tab);
  else if (actionPopupPort && actionPopupVisible) {
    if (actionPopupMode === 'notification') {
      await chrome.storage.session.remove(ACTION_NOTIFICATION_KEY);
      try { actionPopupPort.postMessage({ type: 'quadruzz-action-replace', panel: 'popup' }); }
      catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
      return;
    }
    try { actionPopupPort.postMessage({ type: 'quadruzz-action-close' }); }
    catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
  } else await openActionPopup(tab);
}

async function getState() {
  const state = await chrome.storage.session.get(['overlayMode', 'activeTabId']);
  return { mode: state.overlayMode || 'hidden', activeTabId: state.activeTabId || null };
}

async function resetState() { await chrome.storage.session.set({ overlayMode: 'hidden', activeTabId: null }); }

async function sendVisibleActionNotification(notification) {
  const port = actionPopupPort;
  if (!port || !actionPopupVisible) return false;
  const deliveryId = ++actionNotificationSequence;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingActionNotifications.delete(deliveryId);
      resolve(false);
    }, 200);
    pendingActionNotifications.set(deliveryId, (delivered) => {
      clearTimeout(timeout);
      pendingActionNotifications.delete(deliveryId);
      resolve(delivered);
    });
    try { port.postMessage({ type: 'quadruzz-action-note', notification, deliveryId }); }
    catch {
      clearTimeout(timeout);
      pendingActionNotifications.delete(deliveryId);
      if (actionPopupPort === port) { actionPopupPort = null; actionPopupVisible = false; }
      resolve(false);
    }
  });
}

async function deliverNoteNotification(notification) {
  if (!notification?.userId || !notification?.note || !notification?.noteUpdatedAt) return;
  const key = notification.userId + ':' + notification.noteUpdatedAt;
  const now = Date.now();
  for (const [seenKey, seenAt] of seenNoteNotifications) if (now - seenAt > 10000) seenNoteNotifications.delete(seenKey);
  if (seenNoteNotifications.has(key)) return;
  const storedSeen = await chrome.storage.session.get('seenNoteNotificationKeys');
  const persistedSeen = storedSeen.seenNoteNotificationKeys || {};
  if (now - Number(persistedSeen[key] || 0) <= 10000) return;
  seenNoteNotifications.set(key, now);
  persistedSeen[key] = now;
  for (const [storedKey, storedAt] of Object.entries(persistedSeen)) if (now - Number(storedAt) > 10000) delete persistedSeen[storedKey];
  await chrome.storage.session.set({ seenNoteNotificationKeys: persistedSeen });
  const state = await getState();
  let tab = null;
  if (state.mode === 'role' || state.mode === 'note') tab = await chrome.tabs.get(state.activeTabId).catch(() => null);
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (state.mode === 'popup' && tab?.id === state.activeTabId && isInjectableTab(tab)) return;
  if (!isInjectableTab(tab)) {
    if (await sendVisibleActionNotification(notification)) {
      await chrome.storage.session.remove(ACTION_NOTIFICATION_KEY);
      return;
    }
    await chrome.storage.session.set({ [ACTION_NOTIFICATION_KEY]: notification });
    const opened = await openActionPopup(tab, 'notification');
    if (opened) return;
  }
  const delivered = await tell(tab?.id, 'quadruzz-note-notification', undefined, notification);
  if (!delivered) {
    await chrome.notifications.create('quadruzz-note-' + key, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: notification.displayName + (notification.actingState ? ' — ' + notification.actingState : ''),
      message: notification.note,
      priority: 2,
    });
  }
}
async function clearNoteNotifications(tabId) {
  await tell(tabId, 'quadruzz-clear-notifications');
}

function connectionCallbackUrl() { return `https://${chrome.runtime.id}.chromiumapp.org/quadruzz`; }
function connectionAuthorizationUrl() { return BASE + '/extension/authorize?redirect_uri=' + encodeURIComponent(connectionCallbackUrl()); }

async function openConnectionTab() {
  if (connectionOpening) return connectionOpening;
  connectionOpening = (async () => {
    const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
    if (stored.connectTabId) {
      try {
        const existing = await chrome.tabs.get(stored.connectTabId);
        if (existing.url && await completeConnection(existing.id, existing.url)) return;
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
        await broadcast('quadruzz-connect-started');
        return;
      } catch { await chrome.storage.session.remove(CONNECT_TAB_KEY); }
    }
    const tab = await chrome.tabs.create({ url: connectionAuthorizationUrl(), active: true });
    if (tab.id) {
      await chrome.storage.session.set({ connectTabId: tab.id });
      const current = await chrome.tabs.get(tab.id).catch(() => null);
      if (current?.url && await completeConnection(tab.id, current.url)) return;
    }
    await broadcast('quadruzz-connect-started');
  })();
  try { await connectionOpening; } finally { connectionOpening = null; }
}
async function completeConnection(tabId, url) {
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId !== tabId || !url.startsWith(connectionCallbackUrl())) return false;
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get('token');
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  if (token) {
    await chrome.storage.local.set({ token });
    await rememberAccess('approved');
    await startActivityHeartbeat();
  }
  try { await chrome.tabs.remove(tabId); } catch { /* The connection tab may already be closing. */ }
  try { await chrome.runtime.sendMessage({ type: token ? 'quadruzz-connect-complete' : 'quadruzz-connect-cancelled' }); } catch { /* No visible overlay is listening. */ }
  return true;
}

async function ensureAccessCredential() {
  cachedAccessState = 'pending';
  cachedAccessAt = Date.now();
  await broadcast('quadruzz-access-pending');
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  const tab = await chrome.tabs.create({ url: connectionAuthorizationUrl(), active: false });
  if (tab.id) await chrome.storage.session.set({ connectTabId: tab.id });
}

async function rememberAccess(state) {
  cachedAccessState = state;
  cachedAccessAt = Date.now();
  const stored = await chrome.storage.session.get(['cachedAccessState', 'cachedAccessAt']);
  if (stored.cachedAccessState !== state || Date.now() - Number(stored.cachedAccessAt || 0) > 2000) {
    await chrome.storage.session.set({ cachedAccessState: state, cachedAccessAt });
  }
}
async function accessState(force = false) {
  if (!force && Date.now() - cachedAccessAt <= ACCESS_CACHE_MS) return cachedAccessState;
  try {
    const cached = await chrome.storage.session.get(['cachedAccessState', 'cachedAccessAt']);
    if (!force && Date.now() - Number(cached.cachedAccessAt || 0) <= ACCESS_CACHE_MS) { cachedAccessState = cached.cachedAccessState; cachedAccessAt = cached.cachedAccessAt; return cachedAccessState; }
    const stored = await chrome.storage.local.get('token');
    if (!stored.token) { cachedAccessState = 'none'; cachedAccessAt = Date.now(); return 'none'; }
    const response = await fetch(BASE + '/api/extension', { headers: { authorization: 'Bearer ' + stored.token }, cache: 'no-store' });
    if (response.status === 401) {
      await chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt']);
      cachedAccessState = 'none'; cachedAccessAt = Date.now(); return 'none';
    }
    if (!response.ok) return 'uncertain';
    const data = await response.json();
    cachedAccessState = data.accessState === 'approved' ? 'approved' : data.accessState === 'pending' ? 'pending' : 'none';
    cachedAccessAt = Date.now();
    return cachedAccessState;
  } catch { return 'uncertain'; }
}

async function applyAccessView(tabId, state) {
  const overlay = await getState();
  const targetTabId = tabId || overlay.activeTabId;
  const message = state === 'pending' ? 'quadruzz-access-pending' : state === 'uncertain' ? 'quadruzz-access-checking' : 'quadruzz-connect-cancelled';
  if (overlay.mode === 'popup') {
    await broadcast(message);
    return;
  }
  if (overlay.mode !== 'hidden') {
    await chrome.storage.session.set({ overlayMode: 'hidden', activeTabId: targetTabId || null });
    await tell(targetTabId, 'quadruzz-hide');
  }
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
  if (mode === 'hidden') {
    await chrome.storage.session.set({ overlayMode: mode, activeTabId });
    await tell(activeTabId, 'quadruzz-hide');
    return;
  }
  await chrome.storage.session.set({ overlayMode: mode, activeTabId });
  await tell(activeTabId, 'quadruzz-show', mode);
  void clearNoteNotifications(activeTabId);
  const currentAccess = await accessState();
  await broadcast(currentAccess === 'approved' ? 'quadruzz-access-approved' : currentAccess === 'pending' ? 'quadruzz-access-pending' : currentAccess === 'uncertain' ? 'quadruzz-access-checking' : 'quadruzz-connect-cancelled');
}

async function togglePanel(tab, panel) {
  const state = await getState();
  const activeTabId = tab?.id || state.activeTabId;
  let currentAccess = await accessState();
  if (currentAccess !== 'approved') currentAccess = await accessState(true);
  if (currentAccess !== 'approved') {
    await applyAccessView(activeTabId, currentAccess);
    return;
  }
  if (!isInjectableTab(tab)) {
    if (actionPopupPort && actionPopupVisible) {
      if (actionPopupMode === 'notification') {
        await chrome.storage.session.remove(ACTION_NOTIFICATION_KEY);
        try { actionPopupPort.postMessage({ type: 'quadruzz-action-replace', panel }); }
        catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
        return;
      }
      try { actionPopupPort.postMessage({ type: 'quadruzz-action-panel-toggle', panel }); return; }
      catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
    }
    await openActionPopup(tab, panel);
    return;
  }
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

chrome.runtime.onStartup.addListener(() => { void resetState(); void startActivityHeartbeat(); void ensureOffscreen(); });
chrome.runtime.onInstalled.addListener(() => { void resetState(); void startActivityHeartbeat(); void ensureOffscreen(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ACTIVITY_ALARM) { void synchronizeActivity(); void ensureOffscreen(); } });
chrome.action.onClicked.addListener((tab) => {
  if (!acceptShortcut('quadruzz-toggle')) return;
  void queueOverlay(() => toggleForTab(tab));
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await configureActionPopup(tab);
  const state = await getState();
  if (!isInjectableTab(tab)) {
    if (state.mode !== 'hidden') {
      await tell(state.activeTabId, 'quadruzz-hide');
      await resetState();
    }
    return;
  }
  await chrome.storage.session.set({ activeTabId: tabId });
  if (state.mode === 'hidden') return;
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tabId, 'quadruzz-show', state.mode);
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  const pendingNotification = await chrome.storage.session.get(ACTION_NOTIFICATION_KEY);
  if (!isInjectableTab(tab) && pendingNotification[ACTION_NOTIFICATION_KEY]) {
    await openActionPopup(tab, 'notification');
    return;
  }
  const state = await getState();
  if (state.mode === 'hidden') return;
  if (!isInjectableTab(tab) || tab.id === state.activeTabId) return;
  await chrome.storage.session.set({ activeTabId: tab.id });
  await tell(state.activeTabId, 'quadruzz-hide');
  await tell(tab.id, 'quadruzz-show', state.mode);
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') await configureActionPopup(tab);
  const destination = changeInfo.url || tab.url;
  if (destination && await completeConnection(tabId, destination)) return;
  const state = await getState();
  if (tab.active && !isInjectableTab(tab)) {
    if (state.mode !== 'hidden') {
      await tell(state.activeTabId, 'quadruzz-hide');
      await resetState();
    }
    return;
  }
  if (state.mode !== 'hidden' && tab.active && changeInfo.status === 'complete') await tell(tabId, 'quadruzz-show', state.mode);
});
chrome.tabs.onCreated.addListener((tab) => { void configureActionPopup(tab); });
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId !== tabId) return;
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  try { await chrome.runtime.sendMessage({ type: 'quadruzz-connect-cancelled' }); } catch { /* No visible overlay is listening. */ }
});
let lastShortcutType = '';
let lastShortcutAt = 0;
function acceptShortcut(type) { const now = Date.now(); if (type === lastShortcutType && now - lastShortcutAt < 180) return false; lastShortcutType = type; lastShortcutAt = now; return true; }

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-cross-member-popup-q' && command !== 'toggle-role' && command !== 'toggle-note') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const type = command === 'toggle-cross-member-popup-q' ? 'quadruzz-toggle' : command === 'toggle-role' ? 'quadruzz-role-toggle' : 'quadruzz-note-toggle';
  if (!acceptShortcut(type)) return;
  await queueOverlay(() => command === 'toggle-cross-member-popup-q' ? toggleForTab(tab) : command === 'toggle-role' ? toggleRole(tab) : toggleNote(tab));
});

chrome.notifications.onClicked.addListener((notificationId) => { void chrome.notifications.clear(notificationId); void chrome.tabs.create({ url: BASE, active: true }); });
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'quadruzz-action-popup') return;
  actionPopupPort = port;
  actionPopupVisible = false;
  actionPopupMode = 'popup';
  port.onMessage.addListener((message) => {
    if (actionPopupPort !== port) return;
    if (message?.type === 'quadruzz-action-visibility') {
      actionPopupVisible = message.visible === true;
      if (['popup', 'role', 'note', 'notification'].includes(message.mode)) actionPopupMode = message.mode;
    }
    if (message?.type === 'quadruzz-action-replace-request' && ['popup', 'role', 'note'].includes(message.panel)) {
      void chrome.storage.session.remove(ACTION_NOTIFICATION_KEY).then(() => port.postMessage({ type: 'quadruzz-action-replace', panel: message.panel })).catch(() => {});
    }
    if (message?.type === 'quadruzz-action-note-rendered') pendingActionNotifications.get(Number(message.deliveryId))?.(true);
  });
  port.onDisconnect.addListener(() => {
    if (actionPopupPort !== port) return;
    actionPopupPort = null;
    actionPopupVisible = false;
    actionPopupMode = 'popup';
    for (const settle of pendingActionNotifications.values()) settle(false);
    pendingActionNotifications.clear();
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.token) void ensureOffscreen().then(sendOffscreenToken);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'quadruzz-offscreen-token-request') {
    void chrome.storage.local.get('token').then(({ token = null }) => sendResponse({ token }));
    return true;
  }
  if (message?.type === 'quadruzz-open-hq') void chrome.tabs.create({ url: BASE, active: true });
  if (message?.type === 'quadruzz-connect') {
    void openConnectionTab()
      .then(() => sendResponse({ ok: true }))
      .catch(async () => { await broadcast('quadruzz-connect-cancelled'); sendResponse({ ok: false }); });
    return true;
  }
  if (message?.type === 'quadruzz-connect-state') {
    void chrome.storage.session.get(CONNECT_TAB_KEY).then((stored) => sendResponse({ connecting: Boolean(stored.connectTabId) }));
    return true;
  }
  if (message?.type === 'quadruzz-access-state') void rememberAccess(message.state);
  if (message?.type === 'quadruzz-central-access') {
    void rememberAccess(message.state);
    if (message.state !== 'approved') void chrome.storage.session.remove('cachedMemberSnapshot');
  }
  if (message?.type === 'quadruzz-central-snapshot' && message.data?.accessState === 'approved') void chrome.storage.session.set({ cachedMemberSnapshot: message.data });
  if (message?.type === 'quadruzz-central-note') void deliverNoteNotification(message.notification);
  if (message?.type === 'quadruzz-central-unauthorized') void chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt']).then(async () => { await chrome.storage.session.remove('cachedMemberSnapshot'); await rememberAccess('none'); await applyAccessView(undefined, 'none'); });
  if (message?.type === 'quadruzz-account-changing') {
    void chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt']).then(() => { cachedAccessState = 'none'; cachedAccessAt = Date.now(); return broadcast('quadruzz-connect-cancelled'); });
  }
  if (message?.type === 'quadruzz-access-requested') void ensureAccessCredential().catch(() => broadcast('quadruzz-access-pending'));
  if (message?.type === 'quadruzz-membership-lost') void applyAccessView(sender.tab?.id, 'none');
  if (message?.type === 'quadruzz-authenticated') void synchronizeActivity();
  if (message?.type === 'quadruzz-toggle' && acceptShortcut(message.type)) void queueOverlay(() => toggleForTab(sender.tab));
  if (message?.type === 'quadruzz-role-toggle' && acceptShortcut(message.type)) void queueOverlay(() => toggleRole(sender.tab));
  if (message?.type === 'quadruzz-note-toggle' && acceptShortcut(message.type)) void queueOverlay(() => toggleNote(sender.tab));
  if (message?.type === 'quadruzz-force-popup') {
    void queueOverlay(async () => {
      await chrome.storage.session.set({ overlayMode: 'popup', activeTabId: sender.tab?.id });
      await tell(sender.tab?.id, 'quadruzz-show', 'popup');
    });
  }
  if (message?.type === 'quadruzz-close') {
    void queueOverlay(async () => {
      await chrome.storage.session.set({ overlayMode: 'hidden', activeTabId: null });
      await tell(sender.tab?.id, 'quadruzz-hide');
    });
  }
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

void startActivityHeartbeat();
void ensureOffscreen();
void configureOpenActionPopups();
