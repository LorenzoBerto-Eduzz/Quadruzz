const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const app = document.querySelector('#app');
document.querySelector('#close').addEventListener('click', () => window.close());
const storage = { get: (key) => new Promise((resolve) => chrome.storage.local.get(key, resolve)), set: (value) => new Promise((resolve) => chrome.storage.local.set(value, resolve)), remove: (key) => new Promise((resolve) => chrome.storage.local.remove(key, resolve)) };
const imageUrls = new Map();

async function api(path) {
  const { token } = await storage.get('token');
  const response = await fetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (response.status === 401) await storage.remove('token');
  return response;
}

function signInView(message = '') {
  app.innerHTML = `<div class="connect"><p class="muted">Use your Quadruzz account to continue.</p><button class="primary" id="sign-in">Sign in with ChatGPT</button>${message ? `<p class="error">${message}</p>` : ''}</div>`;
  document.querySelector('#sign-in').addEventListener('click', signIn);
}

async function signIn() {
  const redirectUrl = chrome.identity.getRedirectURL('quadruzz');
  const authorizeUrl = `${BASE}/extension/authorize?redirect_uri=${encodeURIComponent(redirectUrl)}`;
  try {
    const callback = await chrome.identity.launchWebAuthFlow({ url: authorizeUrl, interactive: true });
    if (!callback) throw new Error();
    const token = new URLSearchParams(new URL(callback).hash.slice(1)).get('token');
    if (!token) throw new Error();
    await storage.set({ token });
    await loadMembers();
  } catch { signInView('Sign-in was not completed.'); }
}

async function memberImage(member, token) {
  const key = `${member.userId}:${member.imageVersion}`;
  if (imageUrls.has(key)) return imageUrls.get(key);
  const response = await fetch(`${BASE}/api/extension/profile-image?user=${encodeURIComponent(member.userId)}&v=${member.imageVersion}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) return '';
  const url = URL.createObjectURL(await response.blob());
  imageUrls.set(key, url);
  return url;
}

function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }

async function loadMembers() {
  const { token } = await storage.get('token');
  if (!token) return signInView();
  try {
    const response = await api('/api/extension');
    if (response.status === 401) return signInView('Please sign in again.');
    if (!response.ok) throw new Error();
    const data = await response.json();
    const images = await Promise.all(data.members.map((member) => memberImage(member, token)));
    app.innerHTML = `<ul class="members">${data.members.map((member, index) => `<li class="member ${member.online ? 'online' : 'offline'}"><img src="${images[index]}" alt=""><span class="name">${escapeHtml(member.displayName)}${member.userId === data.currentUserId ? ' <small class="you">You</small>' : ''}</span><span class="status">${member.online ? 'Online' : 'Offline'}</span></li>`).join('')}</ul>`;
  } catch { app.innerHTML = '<p class="error">Could not reach Quadruzz.</p>'; }
}

void loadMembers();
const refreshTimer = setInterval(loadMembers, 1000);
window.addEventListener('unload', () => clearInterval(refreshTimer));
