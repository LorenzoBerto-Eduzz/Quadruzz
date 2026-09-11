async function tell(tabId, type) {
  if (!tabId) return;
  try { await chrome.tabs.sendMessage(tabId, { type }); } catch { /* Restricted or unloaded tab. */ }
}

async function getState() {
  const state = await chrome.storage.session.get(['overlayVisible', 'activeTabId']);
  return { visible: state.overlayVisible === true, activeTabId: state.activeTabId || null };
}

async function resetState() { await chrome.storage.session.set({ overlayVisible: false, activeTabId: null }); }

async function toggle(tab) {
  const state = await getState();
  const visible = !state.visible;
  const activeTabId = tab?.id || state.activeTabId;
  await chrome.storage.session.set({ overlayVisible: visible, activeTabId });
  await tell(activeTabId, visible ? 'quadruzz-show' : 'quadruzz-hide');
}

chrome.runtime.onStartup.addListener(resetState);
chrome.runtime.onInstalled.addListener(resetState);
chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await toggle(tab);
});
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
  if (message?.type === 'quadruzz-close') {
    void chrome.storage.session.set({ overlayVisible: false });
    void tell(sender.tab?.id, 'quadruzz-hide');
  }
  if (message?.type === 'quadruzz-shortcuts') void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
