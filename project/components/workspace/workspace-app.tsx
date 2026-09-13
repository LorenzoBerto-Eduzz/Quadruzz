'use client';
/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Plus, Settings, X } from 'lucide-react';
import type { WorkspacePayload } from '@/lib/workspace-types';

const SYNC_INTERVAL_MS = 1_000;
const decodedProfileImages = new Map<string, HTMLImageElement>();
const pendingProfileImages = new Map<string, Promise<void>>();

type LocalProfileImage = { url: string; image: HTMLImageElement };

async function decodeLocalProfileImage(file: File): Promise<LocalProfileImage | null> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'sync';
  image.src = url;
  try { await image.decode(); return { url, image }; }
  catch { URL.revokeObjectURL(url); return null; }
}

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
  const visibleUrls = payload.members.filter((member) => member.extensionActive).map((member) => member.imageUrl);
  void Promise.allSettled(visibleUrls.map((url) => decodeProfileImage(url)));
  const backgroundUrls = payload.members.filter((member) => !member.extensionActive).map((member) => member.imageUrl);
  void Promise.allSettled(backgroundUrls.map((url) => decodeProfileImage(url)));
  return payload;
}

async function readPayload(response: Response, fallback: string): Promise<WorkspacePayload> {
  const data = await response.json() as WorkspacePayload & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

async function workspaceApi(init?: RequestInit): Promise<WorkspacePayload> {
  return readPayload(await fetch('/api/workspace', { ...init, cache: 'no-store' }), 'Something went wrong.');
}

function visibleError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : fallback;
  return /D1_ERROR|overloaded|queued for too long|database/i.test(message) ? fallback : message;
}

async function adminApi(action: string, userId: string): Promise<WorkspacePayload> {
  return readPayload(await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  }), 'Administration failed.');
}

function ProfileImage({ src, className, title }: { src: string; className?: string; title?: string }) {
  return <img className={className} src={src} alt="" title={title} decoding="sync" loading="eager" />;
}

function activityTime(createdAt: number): string {
  return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(createdAt));
}

export function WorkspaceApp({ initialData, extensionAuthorizeUrl = null }: { initialData: WorkspacePayload; extensionAuthorizeUrl?: string | null }) {
  const [data, setData] = useState<WorkspacePayload>(initialData);
  const [peopleReady, setPeopleReady] = useState(initialData.accessState !== 'approved' || !initialData.members.length);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const requestEpoch = useRef(0);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const epoch = requestEpoch.current;
    try {
      const next = await prepareWorkspacePayload(await workspaceApi());
      if (requestEpoch.current === epoch) {
        setData(next);
        setError('');
      }
    } catch {
      // Background synchronization keeps the last good state instead of exposing infrastructure errors.
    }
  }, []);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await workspaceApi({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) }));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Request failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const decideRequest = useCallback(async (action: 'approve' | 'reject', userId: string) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi(action, userId));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Request decision failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const removeAccess = useCallback(async (userId: string) => {
    if (!window.confirm('Remove this member’s access? They will need to request approval again.')) return;
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi('remove_member', userId));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Member removal failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const finishProfile = useCallback(async (displayName: string, image: File | null, preparedImage?: Promise<LocalProfileImage | null>) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const localImagePromise = image ? preparedImage || decodeLocalProfileImage(image) : Promise.resolve(null);
      const form = new FormData();
      form.set('displayName', displayName);
      if (image) form.set('image', image);
      const [payload, localImage] = await Promise.all([
        readPayload(await fetch('/api/profile-image', { method: 'POST', body: form }), 'Profile setup failed.'),
        localImagePromise,
      ]);
      const currentUserId = payload.currentUser?.userId;
      const serverImageUrl = payload.members.find((member) => member.userId === currentUserId)?.imageUrl;
      const localPayload = localImage && currentUserId
        ? { ...payload, members: payload.members.map((member) => member.userId === currentUserId ? { ...member, imageUrl: localImage.url } : member) }
        : payload;
      if (localImage) decodedProfileImages.set(localImage.url, localImage.image);
      const next = await prepareWorkspacePayload(localPayload);
      if (serverImageUrl) void decodeProfileImage(serverImageUrl);
      if (requestEpoch.current === epoch) setData(next);
      return true;
    } catch (cause) { setError(visibleError(cause, 'Profile setup failed. Please try again.')); return false; }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'leave_all' }), cache: 'no-store', keepalive: true });
    } finally {
      window.location.assign('/signout-with-chatgpt?return_to=/');
    }
  }, []);
  const saveProfile = useCallback(async (displayName: string, image: File | null) => {
    if (image) await finishProfile(displayName, image);
    else await act('update_profile', { displayName });
  }, [act, finishProfile]);

  useEffect(() => {
    let cancelled = false;
    if (initialData.accessState === 'approved' && initialData.members.length) {
      void prepareWorkspacePayload(initialData).then(() => { if (!cancelled) setPeopleReady(true); });
    }
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [initialData, refresh]);
  const accessState = data?.accessState;
  useEffect(() => {
    if (busy || !accessState) return;
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
    if (extensionAuthorizeUrl && (data.accessState === 'approved' || data.accessState === 'pending')) window.location.replace(extensionAuthorizeUrl);
  }, [data.accessState, extensionAuthorizeUrl]);
  useEffect(() => {
    const synchronizeVisiblePage = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', synchronizeVisiblePage);
    window.addEventListener('pageshow', synchronizeVisiblePage);
    document.addEventListener('visibilitychange', synchronizeVisiblePage);
    return () => {
      window.removeEventListener('focus', synchronizeVisiblePage);
      window.removeEventListener('pageshow', synchronizeVisiblePage);
      document.removeEventListener('visibilitychange', synchronizeVisiblePage);
    };
  }, [refresh]);
  useEffect(() => {
    if (!settingsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!settingsRef.current?.contains(target) && !gearRef.current?.contains(target)) setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [settingsOpen]);

  if (data.accessState === 'not_requested' || data.accessState === 'rejected' || data.accessState === 'pending' || data.accessState === 'onboarding') {
    return <ProfileSetup data={data} finishProfile={finishProfile} busy={busy} error={error} extensionAuthorizeUrl={extensionAuthorizeUrl} />;
  }

  return (
    <main className="quadro">
      <div className={`people${peopleReady ? '' : ' people-loading'}`} aria-label="Quadruzz members">
        {data.members.map((member) => (
          <ProfileImage className={`person${member.extensionActive ? '' : ' person-inactive'}`} src={member.imageUrl} title={member.displayName} key={member.userId} />
        ))}
      </div>

      {settingsOpen && (
        <dialog ref={settingsRef} className="settings-popup" aria-label="Quadruzz settings" open>

          <ProfileSettings key={data.currentUser?.displayName || ''} displayName={data.currentUser?.displayName || ''} saveProfile={saveProfile} closeSettings={() => setSettingsOpen(false)} busy={busy} />
          <button className="sign-out" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
          <div className="settings-divider" />
          <h3 className="members-title">Members</h3>

          <ul className="member-list">
            {data.members.map((member) => (
              <li key={member.userId}>
                <ProfileImage src={member.imageUrl} />
                <span>{member.displayName}</span>
                {member.canRemove && (
                  <button className="remove-member" type="button" aria-label={`Remove ${member.displayName}’s access`} title="Remove access" disabled={busy} onClick={() => void removeAccess(member.userId)}><X aria-hidden="true" /></button>
                )}
              </li>
            ))}
            {data.requests.map((request) => (
              <li className="pending-member" key={request.userId}>
                <span>{request.email}</span>
                <div className="request-actions">
                  <button className="approve-request" type="button" aria-label={`Approve ${request.email}`} title="Approve" disabled={busy} onClick={() => void decideRequest('approve', request.userId)}><Check aria-hidden="true" /></button>
                  <button className="reject-request" type="button" aria-label={`Reject ${request.email}`} title="Reject" disabled={busy} onClick={() => void decideRequest('reject', request.userId)}><X aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="settings-divider" />
          <button className="activity-toggle" type="button" aria-expanded={activityOpen} onClick={() => setActivityOpen((open) => !open)}>Log</button>
          {activityOpen && (
            <section className="activity-panel" aria-label="Recent activity">
              {data.activity.length ? (
                <ul className="activity-list">
                  {data.activity.map((entry) => (
                    <li key={entry.id}><span>{entry.message}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{activityTime(entry.createdAt)}</time></li>
                  ))}
                </ul>
              ) : <p className="activity-empty">No activity yet</p>}
            </section>
          )}
          {error && <p className="plain-error">{error}</p>}
        </dialog>
      )}

      <button ref={gearRef} className="gear" type="button" aria-label="Settings" title="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>
        <Settings aria-hidden="true" />
        {data.requests.length > 0 && <span className="gear-dot" aria-label={`${data.requests.length} pending request${data.requests.length === 1 ? '' : 's'}`} />}
      </button>
    </main>
  );
}

function ProfileSettings({ displayName, saveProfile, closeSettings }: { displayName: string; saveProfile: (displayName: string, image: File | null) => Promise<void>; closeSettings: () => void; busy: boolean }) {
  const [name, setName] = useState(displayName);

  return (
    <section className="profile-settings">
      <div className="profile-settings-heading">
        <h3>You</h3>
        <button className="settings-close" type="button" aria-label="Close settings" title="Close" onClick={closeSettings}><X aria-hidden="true" /></button>
      </div>
      <input aria-label="Display name" value={name} maxLength={48} placeholder="Display name" required onChange={(event) => setName(event.target.value)} onBlur={() => { if (name.trim() && name.trim() !== displayName) void saveProfile(name, null); }} />
      <input aria-label="New profile image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0] || null; if (file) void saveProfile(name, file); event.currentTarget.value = ''; }} />
    </section>
  );
}
function ProfileSetup({ data, finishProfile, busy, error, extensionAuthorizeUrl }: { data: WorkspacePayload; finishProfile: (displayName: string, image: File | null, preparedImage?: Promise<LocalProfileImage | null>) => Promise<boolean>; busy: boolean; error: string; extensionAuthorizeUrl: string | null }) {
  const pending = data.accessState === 'pending';
  const [optimisticPending, setOptimisticPending] = useState(false);
  const hostOnboarding = data.accessState === 'onboarding' && data.currentUser?.role === 'host';
  const [name, setName] = useState(data.currentUser?.displayName || '');
  const [image, setImage] = useState<File | null>(null);
  const [preparedImage, setPreparedImage] = useState<Promise<LocalProfileImage | null> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function selectImage(file: File | null) {
    const prepared = file ? decodeLocalProfileImage(file) : null;
    setImage(file);
    setPreparedImage(prepared);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (pending && file) void finishProfile(name, file, prepared || undefined);
  }
  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (pending) return;
    if (!image && !data.currentUser?.imageUrl) { setLocalError('Choose an image.'); return; }
    setLocalError('');
    if (!pending && !hostOnboarding) setOptimisticPending(true);
    const succeeded = await finishProfile(name, image, preparedImage || undefined);
    if (!succeeded) setOptimisticPending(false);
  }
  const waiting = pending || optimisticPending;
  const buttonLabel = waiting ? 'Waiting for approval' : busy && hostOnboarding ? 'Entering…' : hostOnboarding ? 'Enter' : 'Request access';
  const accountReturnTo = extensionAuthorizeUrl || '/';
  const chooseAccountPath = `/authentication?choose=1&return_to=${encodeURIComponent(accountReturnTo)}`;
  const changeAccountPath = `/signout-with-chatgpt?return_to=${encodeURIComponent(chooseAccountPath)}`;
  const imageSource = previewUrl || data.currentUser?.imageUrl || null;
  return (
    <main className="gate">
      <form className="profile-setup" onSubmit={(event) => void submit(event)}>
        <h1>Cross</h1>
        <a className="account-context" href={changeAccountPath} onClick={() => window.postMessage({ type: 'quadruzz-account-changing' }, window.location.origin)}>
          <span>{data.currentUser?.email}</span>
          <span className="account-change">Change</span>
        </a>
        <div className="profile-identity">
          <label className="profile-image-picker" aria-label="Choose profile image">
            <input aria-label="Profile image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required={!data.currentUser?.imageUrl} onChange={(event) => selectImage(event.target.files?.[0] || null)} />
            {imageSource ? <><img src={imageSource} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling?.removeAttribute('hidden'); }} /><span hidden><Plus aria-hidden="true" /></span></> : <Plus aria-hidden="true" />}
          </label>
          <input aria-label="Display name" value={name} maxLength={48} placeholder="Display name" required onChange={(event) => setName(event.target.value)} onBlur={() => { if (pending && name.trim() && name.trim() !== data.currentUser?.displayName) void finishProfile(name, null); }} />
        </div>
        <button className="plain-action" disabled={busy || waiting} type="submit">{buttonLabel}</button>
        {(localError || error) && <span className="plain-error">{localError || error}</span>}
      </form>
    </main>
  );
}
