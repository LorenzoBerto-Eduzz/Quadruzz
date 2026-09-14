const BASE = 'https://cross-quadruzz.l-busslerberto.chatgpt.site';
const POLL_MS = 1000;
const HEARTBEAT_MS = 15000;
let token = null;
let timer = null;
let generation = 0;
let heartbeatAt = 0;
let sessionId = crypto.randomUUID();
let notesInitialized = false;
const noteVersions = new Map();

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'quadruzz-token') return;
  token = event.data.token || null;
  generation += 1;
  notesInitialized = false;
  noteVersions.clear();
  heartbeatAt = 0;
  sessionId = crypto.randomUUID();
  schedule(0, generation);
});

function schedule(delay, expectedGeneration) {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void synchronize(expectedGeneration), delay);
}

function updateNotes(data) {
  const next = new Map();
  for (const member of data.members || []) {
    const version = Number(member.noteUpdatedAt || 0);
    next.set(member.userId, version);
    if (notesInitialized && noteVersions.has(member.userId) && member.userId !== data.currentUserId && member.note && version && noteVersions.get(member.userId) !== version) {
      self.postMessage({
        type: 'quadruzz-central-note',
        notification: {
          userId: member.userId,
          displayName: member.displayName,
          actingState: member.actingState,
          note: member.note,
          noteUpdatedAt: version,
        },
      });
    }
  }
  noteVersions.clear();
  for (const [userId, version] of next) noteVersions.set(userId, version);
  notesInitialized = true;
}

async function heartbeat(expectedGeneration) {
  if (!token || expectedGeneration !== generation || Date.now() - heartbeatAt < HEARTBEAT_MS) return;
  const response = await fetch(BASE + '/api/extension', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ extensionAction: 'heartbeat', extensionSessionId: sessionId }),
  });
  if (response.ok) heartbeatAt = Date.now();
  else if (response.status === 401 || response.status === 403) self.postMessage({ type: 'quadruzz-central-unauthorized' });
}

async function synchronize(expectedGeneration) {
  if (expectedGeneration !== generation) return;
  if (!token) { schedule(POLL_MS, expectedGeneration); return; }
  try {
    const response = await fetch(BASE + '/api/extension', {
      headers: { authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    if (expectedGeneration !== generation) return;
    if (response.status === 401 || response.status === 403) {
      self.postMessage({ type: 'quadruzz-central-unauthorized' });
      schedule(POLL_MS, expectedGeneration);
      return;
    }
    if (response.ok) {
      const data = await response.json();
      self.postMessage({ type: 'quadruzz-central-access', state: data.accessState });
      if (data.accessState === 'approved') {
        self.postMessage({ type: 'quadruzz-central-snapshot', data });
        updateNotes(data);
        await heartbeat(expectedGeneration);
      } else {
        notesInitialized = false;
        noteVersions.clear();
      }
    }
  } catch { /* A later poll retries transient failures. */ }
  if (expectedGeneration === generation) schedule(POLL_MS, expectedGeneration);
}
