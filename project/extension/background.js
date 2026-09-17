const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const ACTIVITY_ALARM = 'cross-quadruzz-activity';
const CONNECT_TAB_KEY = 'connectTabId';
const OFFSCREEN_URL = 'offscreen.html';
const ACTION_POPUP = 'popup.html';
const ACTION_NOTIFICATION_KEY = 'actionPopupNotification';
const ACTIVE_NOTIFICATIONS_KEY = 'activeNoteNotifications';
const UNREAD_NOTES_KEY = 'unreadNoteKeys';
const DISPLAYED_NOTES_KEY = 'displayedNoteVersions';
const ACCESS_CACHE_MS = 3000;
const seenNoteNotifications = new Map();
const pendingActionNotifications = new Map();
let actionPopupPort = null;
let actionPopupVisible = false;
let actionPopupMode = 'popup';
let actionNotificationSequence = 0;
let cachedAccessState = 'unknown';
let cachedAccessAt = 0;
let connectionOpening = null;
let popupOperation = Promise.resolve();
let offscreenCreating = null;

function queuePopup(operation) { popupOperation = popupOperation.then(operation, operation); return popupOperation; }
async function broadcast(type) { try { await chrome.runtime.sendMessage({ type }); } catch { /* No popup is listening. */ } }

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
  try { await offscreenCreating; } catch { /* Startup and alarms retry creation. */ }
  finally { offscreenCreating = null; }
}

async function sendOffscreenToken() {
  const { token = null } = await chrome.storage.local.get('token');
  try { await chrome.runtime.sendMessage({ type: 'quadruzz-offscreen-token', token }); }
  catch { /* The worker requests the token when it starts. */ }
}

async function setUnreadBadge(visible) {
  await chrome.action.setBadgeBackgroundColor({ color: '#1687ff' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' }).catch(() => {});
  await chrome.action.setBadgeText({ text: visible ? '•' : '' });
  await chrome.action.setTitle({ title: visible ? 'Cross-Quadruzz — new note' : 'Toggle Cross-Quadruzz' });
}

async function rememberUnreadNote(notification) {
  const key = `${notification.userId}:${notification.noteUpdatedAt}`;
  const stored = await chrome.storage.local.get(UNREAD_NOTES_KEY);
  const unread = stored[UNREAD_NOTES_KEY] || {};
  unread[key] = Date.now();
  await chrome.storage.local.set({ [UNREAD_NOTES_KEY]: unread });
  await setUnreadBadge(true);
}

async function clearUnreadNotes() {
  await chrome.storage.local.remove(UNREAD_NOTES_KEY);
  await setUnreadBadge(false);
}

async function restoreUnreadBadge() {
  const stored = await chrome.storage.local.get(UNREAD_NOTES_KEY);
  await setUnreadBadge(Boolean(Object.keys(stored[UNREAD_NOTES_KEY] || {}).length));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function openActionPopup(tab, panel = 'popup') {
  if (!tab?.id || !tab.windowId) return false;
  const targetWindow = await chrome.windows.get(tab.windowId).catch(() => null);
  if (!targetWindow?.focused) return false;
  await chrome.action.setPopup({ tabId: tab.id, popup: `${ACTION_POPUP}?action=${panel}` });
  try {
    await chrome.action.openPopup({ windowId: tab.windowId });
    return true;
  } catch { return false; }
  finally { await chrome.action.setPopup({ tabId: tab.id, popup: ACTION_POPUP }); }
}

async function clearTransientNotifications(closePopup = true) {
  await chrome.storage.session.remove([ACTIVE_NOTIFICATIONS_KEY, ACTION_NOTIFICATION_KEY]);
  if (closePopup && actionPopupVisible && actionPopupMode === 'notification') {
    try { actionPopupPort?.postMessage({ type: 'quadruzz-action-close' }); } catch { /* Already closed. */ }
  }
}

async function toggleMemberPopup(tab) {
  await clearUnreadNotes();
  if (actionPopupPort && actionPopupVisible) {
    if (actionPopupMode !== 'popup') {
      if (actionPopupMode === 'notification') await clearTransientNotifications(false);
      try { actionPopupPort.postMessage({ type: 'quadruzz-action-replace', panel: 'popup' }); }
      catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
      return;
    }
    try { actionPopupPort.postMessage({ type: 'quadruzz-action-close' }); }
    catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
    return;
  }
  await clearTransientNotifications(false);
  await openActionPopup(tab, 'popup');
}

async function togglePanel(tab, panel) {
  let currentAccess = await accessState();
  if (currentAccess !== 'approved') currentAccess = await accessState(true);
  if (currentAccess !== 'approved') {
    await openActionPopup(tab, 'popup');
    await broadcast(currentAccess === 'pending' ? 'quadruzz-access-pending' : currentAccess === 'uncertain' ? 'quadruzz-access-checking' : 'quadruzz-connect-cancelled');
    return;
  }
  if (actionPopupPort && actionPopupVisible) {
    if (actionPopupMode === 'notification') {
      await clearTransientNotifications(false);
      try { actionPopupPort.postMessage({ type: 'quadruzz-action-replace', panel }); }
      catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
      return;
    }
    try { actionPopupPort.postMessage({ type: 'quadruzz-action-panel-toggle', panel }); return; }
    catch { actionPopupPort = null; actionPopupVisible = false; actionPopupMode = 'popup'; }
  }
  await openActionPopup(tab, panel);
}

async function sendVisibleActionNotification(notification) {
  const port = actionPopupPort;
  if (!port || !actionPopupVisible) return false;
  const deliveryId = ++actionNotificationSequence;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { pendingActionNotifications.delete(deliveryId); resolve(false); }, 1000);
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

async function readActiveNoteNotifications() {
  const stored = await chrome.storage.session.get(ACTIVE_NOTIFICATIONS_KEY);
  const existing = Array.isArray(stored[ACTIVE_NOTIFICATIONS_KEY]) ? stored[ACTIVE_NOTIFICATIONS_KEY] : [];
  const active = existing.filter((item) => Number(item?.expiresAt || 0) > Date.now());
  if (active.length !== existing.length) await chrome.storage.session.set({ [ACTIVE_NOTIFICATIONS_KEY]: active });
  return active;
}

async function rememberActiveNoteNotification(notification) {
  const active = await readActiveNoteNotifications();
  const item = { ...notification, expiresAt: Date.now() + 5000 };
  const key = `${item.userId}:${item.noteUpdatedAt}`;
  const next = active.filter((entry) => `${entry.userId}:${entry.noteUpdatedAt}` !== key);
  next.unshift(item);
  await chrome.storage.session.set({ [ACTIVE_NOTIFICATIONS_KEY]: next, [ACTION_NOTIFICATION_KEY]: item });
  return item;
}

async function showSystemNotification(notification, key) {
  await chrome.notifications.create(`quadruzz-note-${key}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: notification.displayName + (notification.actingState ? ` — ${notification.actingState}` : ''),
    message: notification.note,
    priority: 2,
  });
}

async function deliverNoteNotification(notification) {
  if (!notification?.userId || !notification?.note || !notification?.noteUpdatedAt) return;
  const key = `${notification.userId}:${notification.noteUpdatedAt}`;
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
  await rememberUnreadNote(notification);

  if (actionPopupVisible && actionPopupMode === 'popup') {
    if (await sendVisibleActionNotification(notification)) await clearUnreadNotes();
    return;
  }
  if (actionPopupVisible && actionPopupMode === 'notification') {
    const active = await rememberActiveNoteNotification(notification);
    if (await sendVisibleActionNotification(active)) return;
  }
  if (actionPopupVisible && (actionPopupMode === 'role' || actionPopupMode === 'note')) {
    await showSystemNotification(notification, key);
    return;
  }
  const item = await rememberActiveNoteNotification(notification);
  const tab = await activeTab();
  if (await openActionPopup(tab, 'notification')) return;
  await showSystemNotification(item, key);
}

function connectionCallbackUrl() { return `https://${chrome.runtime.id}.chromiumapp.org/quadruzz`; }
function connectionAuthorizationUrl() { return `${BASE}/extension/authorize?redirect_uri=${encodeURIComponent(connectionCallbackUrl())}`; }

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
  try { await chrome.tabs.remove(tabId); } catch { /* It may already be closing. */ }
  try { await chrome.runtime.sendMessage({ type: token ? 'quadruzz-connect-complete' : 'quadruzz-connect-cancelled' }); } catch { /* No popup is listening. */ }
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
    if (!force && Date.now() - Number(cached.cachedAccessAt || 0) <= ACCESS_CACHE_MS) {
      cachedAccessState = cached.cachedAccessState;
      cachedAccessAt = cached.cachedAccessAt;
      return cachedAccessState;
    }
    const stored = await chrome.storage.local.get('token');
    if (!stored.token) { cachedAccessState = 'none'; cachedAccessAt = Date.now(); return 'none'; }
    const response = await fetch(`${BASE}/api/extension`, { headers: { authorization: `Bearer ${stored.token}` }, cache: 'no-store' });
    if (response.status === 401) {
      await chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt', 'profileImageCache']);
      cachedAccessState = 'none'; cachedAccessAt = Date.now(); return 'none';
    }
    if (!response.ok) return 'uncertain';
    const data = await response.json();
    cachedAccessState = data.accessState === 'approved' ? 'approved' : data.accessState === 'pending' ? 'pending' : 'none';
    cachedAccessAt = Date.now();
    return cachedAccessState;
  } catch { return 'uncertain'; }
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
      body: JSON.stringify({ extensionAction: 'heartbeat', extensionSessionId, extensionVersion: chrome.runtime.getManifest().version }),
    });
    if (response.status === 401) await chrome.storage.local.remove(['token', 'profileImageCache']);
  } catch { /* The next alarm retries transient failures. */ }
}

async function startActivityHeartbeat() {
  await synchronizeActivity();
  try { await chrome.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 0.5 }); }
  catch { await chrome.alarms.create(ACTIVITY_ALARM, { periodInMinutes: 1 }); }
}

async function initializeExtension() {
  await startActivityHeartbeat();
  await ensureOffscreen();
  await restoreUnreadBadge();
}

chrome.runtime.onStartup.addListener(() => { void initializeExtension(); });
chrome.runtime.onInstalled.addListener(() => { void initializeExtension(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ACTIVITY_ALARM) { void synchronizeActivity(); void ensureOffscreen(); } });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const destination = changeInfo.url || tab.url;
  if (destination) void completeConnection(tabId, destination);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.session.get(CONNECT_TAB_KEY);
  if (stored.connectTabId !== tabId) return;
  await chrome.storage.session.remove(CONNECT_TAB_KEY);
  try { await chrome.runtime.sendMessage({ type: 'quadruzz-connect-cancelled' }); } catch { /* No popup is listening. */ }
});

let lastShortcutType = '';
let lastShortcutAt = 0;
function acceptShortcut(type) {
  const now = Date.now();
  if (type === lastShortcutType && now - lastShortcutAt < 180) return false;
  lastShortcutType = type;
  lastShortcutAt = now;
  return true;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (!['toggle-cross-member-popup-q', 'toggle-role', 'toggle-note'].includes(command)) return;
  const type = command === 'toggle-cross-member-popup-q' ? 'quadruzz-toggle' : command === 'toggle-role' ? 'quadruzz-role-toggle' : 'quadruzz-note-toggle';
  if (!acceptShortcut(type)) return;
  const tab = await activeTab();
  await queuePopup(() => command === 'toggle-cross-member-popup-q' ? toggleMemberPopup(tab) : togglePanel(tab, command === 'toggle-role' ? 'role' : 'note'));
});

chrome.notifications.onClicked.addListener((notificationId) => {
  void queuePopup(async () => {
    await chrome.notifications.clear(notificationId);
    const tab = await activeTab();
    await clearUnreadNotes();
    await clearTransientNotifications(false);
    await openActionPopup(tab, 'popup');
  });
});

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
      if (actionPopupVisible && actionPopupMode === 'popup') {
        void clearUnreadNotes();
        void clearTransientNotifications(false);
      }
    }
    if (message?.type === 'quadruzz-action-replace-request' && ['popup', 'role', 'note'].includes(message.panel)) {
      void clearTransientNotifications(false).then(() => {
        if (message.panel === 'popup') void clearUnreadNotes();
        port.postMessage({ type: 'quadruzz-action-replace', panel: message.panel });
      }).catch(() => {});
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'quadruzz-offscreen-token-request') {
    void chrome.storage.local.get('token').then(({ token = null }) => sendResponse({ token }));
    return true;
  }
  if (message?.type === 'quadruzz-open-hq') void chrome.tabs.create({ url: BASE, active: true });
  if (message?.type === 'quadruzz-connect') {
    void openConnectionTab().then(() => sendResponse({ ok: true })).catch(async () => { await broadcast('quadruzz-connect-cancelled'); sendResponse({ ok: false }); });
    return true;
  }
  if (message?.type === 'quadruzz-connect-state') {
    void chrome.storage.session.get(CONNECT_TAB_KEY).then((stored) => sendResponse({ connecting: Boolean(stored.connectTabId) }));
    return true;
  }
  if (message?.type === 'quadruzz-access-state') void rememberAccess(message.state);
  if (message?.type === 'quadruzz-central-access') {
    void rememberAccess(message.state);
    if (message.state !== 'approved') { void chrome.storage.session.remove('cachedMemberSnapshot'); void chrome.storage.local.remove('profileImageCache'); }
  }
  if (message?.type === 'quadruzz-central-snapshot' && message.data?.accessState === 'approved') void chrome.storage.session.set({ cachedMemberSnapshot: message.data });
  if (message?.type === 'quadruzz-central-note') void deliverNoteNotification(message.notification);
  if (message?.type === 'quadruzz-central-unauthorized' || message?.type === 'quadruzz-account-changing') {
    void chrome.storage.local.remove(['token', 'extensionActivitySessionId', 'extensionActivityPulseAt', 'profileImageCache', UNREAD_NOTES_KEY, DISPLAYED_NOTES_KEY]).then(async () => {
      await chrome.storage.session.remove('cachedMemberSnapshot');
      cachedAccessState = 'none';
      cachedAccessAt = Date.now();
      await setUnreadBadge(false);
      await broadcast('quadruzz-connect-cancelled');
    });
  }
  if (message?.type === 'quadruzz-access-requested') void ensureAccessCredential().catch(() => broadcast('quadruzz-access-pending'));
  if (message?.type === 'quadruzz-membership-lost') void chrome.storage.local.remove(['profileImageCache', UNREAD_NOTES_KEY, DISPLAYED_NOTES_KEY]).then(() => setUnreadBadge(false));
  if (message?.type === 'quadruzz-authenticated') void synchronizeActivity();
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

void initializeExtension();
