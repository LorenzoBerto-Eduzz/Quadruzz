'use client';
/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import type { WorkspacePayload } from '@/lib/workspace-types';

const SYNC_INTERVAL_MS = 250;
const HEARTBEAT_INTERVAL_MS = 15_000;
const decodedProfileImages = new Map<string, HTMLImageElement>();
const pendingProfileImages = new Map<string, Promise<void>>();

function decodeProfileImage(url: string): Promise<void> {
  if (decodedProfileImages.has(url)) return Promise.resolve();
  const pending = pendingProfileImages.get(url);
  if (pending) return pending;

  const image = new Image();
  image.decoding = 'sync';
  image.src = url;
  const decoding = image.decode()
    .then(() => { decodedProfileImages.set(url, image); })
    .finally(() => { pendingProfileImages.delete(url); });
  pendingProfileImages.set(url, decoding);
  return decoding;
}

async function prepareWorkspacePayload(payload: WorkspacePayload): Promise<WorkspacePayload> {
  const visibleUrls = payload.members.filter((member) => member.online).map((member) => member.imageUrl);
  await Promise.all(visibleUrls.map((url) => decodeProfileImage(url)));
  const backgroundUrls = payload.members.filter((member) => !member.online).map((member) => member.imageUrl);
  void Promise.allSettled(backgroundUrls.map((url) => decodeProfileImage(url)));
  return payload;
}

async function readPayload(response: Response, fallback: string): Promise<WorkspacePayload> {
  const data = await response.json() as WorkspacePayload & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function workspaceApi(init?: RequestInit, presenceSessionId?: string): Promise<WorkspacePayload> {
  const url = presenceSessionId ? `/api/workspace?presenceSessionId=${encodeURIComponent(presenceSessionId)}` : '/api/workspace';
  return readPayload(await fetch(url, init), 'Something went wrong.');
}

async function adminApi(action: string, userId: string): Promise<WorkspacePayload> {
  return readPayload(await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  }), 'Administration failed.');
}

export function WorkspaceApp() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const requestEpoch = useRef(0);
  const presenceSessionId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const epoch = requestEpoch.current;
    try {
      presenceSessionId.current ||= crypto.randomUUID();
      const next = await prepareWorkspacePayload(await workspaceApi(undefined, presenceSessionId.current));
      if (requestEpoch.current === epoch) {
        setData(next);
        setError('');
      }
    } catch (cause) {
      if (requestEpoch.current === epoch) setError(cause instanceof Error ? cause.message : 'Workspace unavailable.');
    }
  }, []);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await workspaceApi({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) }));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const decideRequest = useCallback(async (action: 'approve' | 'reject', userId: string) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi(action, userId));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request decision failed.'); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const removeAccess = useCallback(async (userId: string) => {
    if (!window.confirm('Remove this member’s access? They will need to request approval again.')) return;
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi('remove_member', userId));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Member removal failed.'); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const finishProfile = useCallback(async (displayName: string, image: File) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('displayName', displayName);
      form.set('image', image);
      const next = await prepareWorkspacePayload(await readPayload(await fetch('/api/profile-image', { method: 'POST', body: form }), 'Profile setup failed.'));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile setup failed.'); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const saveProfile = useCallback(async (displayName: string, image: File | null) => {
    if (image) await finishProfile(displayName, image);
    else await act('update_profile', { displayName });
  }, [act, finishProfile]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  const accessState = data?.accessState;
  useEffect(() => {
    if (busy || !accessState || accessState === 'not_requested' || accessState === 'rejected') return;
    let cancelled = false;
    let timer: number | undefined;
    const synchronize = async () => {
      await refresh();
      if (!cancelled) timer = window.setTimeout(() => void synchronize(), SYNC_INTERVAL_MS);
    };
    timer = window.setTimeout(() => void synchronize(), SYNC_INTERVAL_MS);
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [accessState, busy, refresh]);
  useEffect(() => {
    if (data?.accessState !== 'approved') return;
    presenceSessionId.current ||= crypto.randomUUID();
    const sessionId = presenceSessionId.current;
    const pulse = async () => {
      try { await fetch('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat', presenceSessionId: sessionId }), keepalive: true }); }
      catch { /* The stale-session cutoff covers lost connectivity. */ }
    };
    const leave = () => {
      const body = new Blob([JSON.stringify({ action: 'leave', presenceSessionId: sessionId })], { type: 'application/json' });
      navigator.sendBeacon('/api/workspace', body);
    };
    const resume = () => { if (document.visibilityState === 'visible') void pulse(); };
    void pulse();
    const timer = window.setInterval(() => void pulse(), HEARTBEAT_INTERVAL_MS);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
      leave();
    };
  }, [data?.accessState]);

  if (!data) return <main className="gate"><span>{error || 'Loading…'}</span></main>;
  if (data.accessState === 'not_requested' || data.accessState === 'rejected') {
    return <main className="gate"><button className="plain-action" disabled={busy} onClick={() => void act('request_access')}>{busy ? 'Sending…' : 'Request access'}</button>{error && <span className="plain-error">{error}</span>}</main>;
  }
  if (data.accessState === 'pending') return <main className="gate"><span>Waiting for approval</span>{error && <span className="plain-error">{error}</span>}</main>;
  if (data.accessState === 'onboarding') return <ProfileSetup data={data} finishProfile={finishProfile} busy={busy} error={error} />;

  const presentMembers = data.members.filter((member) => member.online);
  const isOwner = data.currentUser?.role === 'owner';
  const canManageRequests = isOwner || data.currentUser?.role === 'admin';
  return (
    <main className="quadro">
      <div className="people" aria-label="People currently present">
        {presentMembers.map((member) => (
          <img className="person" src={member.imageUrl} alt={member.displayName} title={member.displayName} decoding="sync" loading="eager" key={member.userId} />
        ))}
      </div>

      {settingsOpen && (
        <dialog className="settings-popup" aria-label="Quadruzz settings" open>
          <header className="settings-header">
            <h2>Members</h2>
            <button className="icon-button" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X aria-hidden="true" /></button>
          </header>

          <ProfileSettings key={data.currentUser?.displayName || ''} displayName={data.currentUser?.displayName || ''} saveProfile={saveProfile} busy={busy} />

          <ul className="member-list">
            {data.members.map((member) => (
              <li key={member.userId}>
                <img src={member.imageUrl} alt="" decoding="sync" loading="eager" />
                <span>{member.displayName}</span>
                {isOwner && member.userId !== data.currentUser?.userId && (
                  <button className="remove-member" type="button" disabled={busy} onClick={() => void removeAccess(member.userId)}>Remove</button>
                )}
                {isOwner && member.role && <small>{member.role}</small>}
              </li>
            ))}
          </ul>

          {canManageRequests && (
            <div className="requests">
              <h3>Requests{data.requests.length > 0 && <span className="request-count">{data.requests.length}</span>}</h3>
              {data.requests.length === 0 ? <p>No pending requests.</p> : data.requests.map((request) => (
                <div className="request" key={request.userId}>
                  <span>{request.email}</span>
                  <div className="request-actions">
                    <button type="button" disabled={busy} onClick={() => void decideRequest('approve', request.userId)}>Approve</button>
                    <button type="button" disabled={busy} onClick={() => void decideRequest('reject', request.userId)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="plain-error">{error}</p>}
          {/* oxlint-disable-next-line next/no-html-link-for-pages */}
          <a className="sign-out" href="/signout-with-chatgpt?return_to=/">Sign out</a>
        </dialog>
      )}

      <button className="gear" type="button" aria-label="Settings" title="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>
        <Settings aria-hidden="true" />
        {canManageRequests && data.requests.length > 0 && <span className="gear-dot" aria-label={`${data.requests.length} pending request${data.requests.length === 1 ? '' : 's'}`} />}
      </button>
    </main>
  );
}

function ProfileSettings({ displayName, saveProfile, busy }: { displayName: string; saveProfile: (displayName: string, image: File | null) => Promise<void>; busy: boolean }) {
  const [name, setName] = useState(displayName);
  const [image, setImage] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);


  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    await saveProfile(name, image);
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <form className="profile-settings" onSubmit={(event) => void submit(event)}>
      <h3>Your profile</h3>
      <input aria-label="Display name" value={name} maxLength={48} placeholder="Display name" required onChange={(event) => setName(event.target.value)} />
      <input ref={fileInput} aria-label="New profile image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setImage(event.target.files?.[0] || null)} />
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

function ProfileSetup({ data, finishProfile, busy, error }: { data: WorkspacePayload; finishProfile: (displayName: string, image: File) => Promise<void>; busy: boolean; error: string }) {
  const [name, setName] = useState(data.currentUser?.displayName || '');
  const [image, setImage] = useState<File | null>(null);
  const [localError, setLocalError] = useState('');
  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!image) { setLocalError('Choose an image.'); return; }
    setLocalError('');
    await finishProfile(name, image);
  }
  return (
    <main className="gate">
      <form className="profile-setup" onSubmit={(event) => void submit(event)}>
        <input aria-label="Display name" value={name} maxLength={48} placeholder="Display name" required onChange={(event) => setName(event.target.value)} />
        <input aria-label="Profile image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={(event) => setImage(event.target.files?.[0] || null)} />
        <button className="plain-action" disabled={busy} type="submit">{busy ? 'Entering…' : 'Enter'}</button>
        {(localError || error) && <span className="plain-error">{localError || error}</span>}
      </form>
    </main>
  );
}