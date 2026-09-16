'use client';
/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Plus, Settings, X } from 'lucide-react';
import type { PublicMember, WorkspacePayload } from '@/lib/workspace-types';

const SYNC_INTERVAL_MS = 1_000;
const CHROME_STORE_URL = '';
const decodedProfileImages = new Map<string, HTMLImageElement>();
const pendingProfileImages = new Map<string, Promise<void>>();

type LocalProfileImage = { url: string; image: HTMLImageElement };
type LogTab = 'roles' | 'notes' | 'status' | 'errors';

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

async function adminApi(action: string, extra: Record<string, unknown> = {}): Promise<WorkspacePayload> {
  return readPayload(await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  }), 'Administration failed.');
}

function ProfileImage({ src, className, title }: { src: string; className?: string; title?: string }) {
  return <img className={className} src={src} alt="" title={title} decoding="sync" loading="eager" />;
}

function EditableMemberRow({ member, busy, saveName, saveImage }: { member: PublicMember; busy: boolean; saveName: (name: string) => Promise<boolean>; saveImage: (name: string, image: File) => Promise<boolean> }) {
  const [name, setName] = useState(member.displayName);
  const [saving, setSaving] = useState(false);
  const cancelEdit = useRef(false);

  async function commitName() {
    if (cancelEdit.current) { cancelEdit.current = false; setName(member.displayName); return; }
    const next = name.trim();
    if (!next || next === member.displayName) { setName(member.displayName); return; }
    setName(next); setSaving(true);
    const saved = await saveName(next);
    if (!saved) setName(member.displayName);
    setSaving(false);
  }

  return (
    <li className="current-member">
      <label className="member-image-editor" aria-label="Choose a new profile image" title="Change profile image">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy || saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveImage(name.trim() || member.displayName, file); event.currentTarget.value = ''; }} />
        <ProfileImage src={member.imageUrl} />
      </label>
      <input className="member-name-editor" aria-label="Your display name" value={name} maxLength={48} disabled={busy || saving} onChange={(event) => setName(event.target.value)} onBlur={() => void commitName()} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); cancelEdit.current = true; event.currentTarget.blur(); }
      }} />
    </li>
  );
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
  const [logsOpen, setLogsOpen] = useState(false);
  const [logTab, setLogTab] = useState<LogTab>('status');
  const [roleStatusesOpen, setRoleStatusesOpen] = useState(false);
  const [extensionUploadBusy, setExtensionUploadBusy] = useState(false);
  const [extensionUploadMessage, setExtensionUploadMessage] = useState('');
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

  const decideRequest = useCallback(async (action: 'approve' | 'reject', userId: string) => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi(action, { userId }));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Request decision failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const removeAccess = useCallback(async (userId: string) => {
    if (!window.confirm('Remove this member’s access? They will need to request approval again.')) return;
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi('remove_member', { userId }));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Member removal failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const deleteRoleStatus = useCallback(async (roleStatus: string) => {
    if (!window.confirm(`Remove “${roleStatus}”? Members using it will be reset to no role status.`)) return;
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    try {
      const next = await prepareWorkspacePayload(await adminApi('delete_role_status', { roleStatus }));
      if (requestEpoch.current === epoch) setData(next);
    } catch (cause) { setError(visibleError(cause, 'Role status removal failed. Please try again.')); }
    finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, []);

  const uploadExtension = useCallback(async (file: File) => {
    setExtensionUploadBusy(true); setExtensionUploadMessage('');
    try {
      const form = new FormData(); form.set('extension', file);
      const response = await fetch('/api/extension-download', { method: 'POST', body: form });
      const result = await response.json() as { error?: string; version?: string };
      if (!response.ok) throw new Error(result.error || 'Extension upload failed.');
      if (result.version) setData((current) => ({ ...current, availableExtensionVersion: result.version }));
      setExtensionUploadMessage(`Download ZIP updated${result.version ? ` to ${result.version}` : ''}.`);
    } catch (cause) { setExtensionUploadMessage(visibleError(cause, 'Extension upload failed.')); }
    finally { setExtensionUploadBusy(false); }
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
      if (payload.accessState === 'pending') window.postMessage({ type: 'quadruzz-access-requested' }, window.location.origin);
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
  const saveOwnName = useCallback(async (displayName: string): Promise<boolean> => {
    const epoch = ++requestEpoch.current;
    setBusy(true); setError('');
    setData((current) => ({
      ...current,
      currentUser: current.currentUser ? { ...current.currentUser, displayName } : current.currentUser,
      members: current.members.map((member) => member.userId === current.currentUser?.userId ? { ...member, displayName } : member),
    }));
    try {
      const next = await prepareWorkspacePayload(await workspaceApi({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update_profile', displayName }) }));
      if (requestEpoch.current === epoch) setData(next);
      return true;
    } catch (cause) {
      setError(visibleError(cause, 'Profile update failed. Please try again.'));
      void refresh();
      return false;
    } finally { if (requestEpoch.current === epoch) setBusy(false); }
  }, [refresh]);
  const saveOwnImage = useCallback((displayName: string, image: File) => finishProfile(displayName, image), [finishProfile]);

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
          <div className="members-heading">
            <h3 className="members-title">Members</h3>
            <button className="settings-close" type="button" aria-label="Close settings" title="Close" onClick={() => setSettingsOpen(false)}><X aria-hidden="true" /></button>
          </div>

          <ul className="member-list">
            {data.members.map((member) => member.userId === data.currentUser?.userId ? (
              <EditableMemberRow key={`${member.userId}:${member.displayName}`} member={member} busy={busy} saveName={saveOwnName} saveImage={saveOwnImage} />
            ) : (
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
          <button className="activity-toggle" type="button" aria-expanded={roleStatusesOpen} onClick={() => setRoleStatusesOpen((open) => !open)}>Role Statuses</button>
          {roleStatusesOpen && (
            <section className="role-status-panel" aria-label="Role statuses">
              {data.roleStatuses.length ? (
                <ul className="role-status-list">
                  {data.roleStatuses.map((roleStatus) => (
                    <li key={roleStatus}>
                      <span>{roleStatus}</span>
                      <button type="button" aria-label={`Remove ${roleStatus}`} title="Remove role status" disabled={busy} onClick={() => void deleteRoleStatus(roleStatus)}><X aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="activity-empty">No role statuses yet</p>}
            </section>
          )}
          <button className="activity-toggle" type="button" aria-expanded={logsOpen} onClick={() => { if (logsOpen) setLogsOpen(false); else { setLogTab('status'); setLogsOpen(true); } }}>Logs</button>
          {logsOpen && (
            <section className="logs-panel" aria-label="Logs">
              <div className="log-tabs" role="tablist" aria-label="Log category">
                {(['roles', 'notes', 'status', 'errors'] as LogTab[]).map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={logTab === tab} className={logTab === tab ? 'active' : ''} onClick={() => setLogTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>
                ))}
              </div>
              <div className="log-content" role="tabpanel">
                {logTab === 'roles' && (data.roleLog.length ? (
                  <ul className="structured-log-list">
                    {data.roleLog.map((entry) => (
                      <li key={entry.id}>
                        <div className="log-entry-heading"><span>{entry.displayName}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{activityTime(entry.createdAt)}</time></div>
                        <p>{entry.oldRole || 'No role'} <span aria-hidden="true">→</span> {entry.newRole || 'No role'}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="activity-empty">No role changes yet</p>)}
                {logTab === 'notes' && (data.noteLog.length ? (
                  <ul className="structured-log-list">
                    {data.noteLog.map((entry) => (
                      <li key={entry.id}>
                        <div className="log-entry-heading"><span>{entry.displayName}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{activityTime(entry.createdAt)}</time></div>
                        <p>{entry.note}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="activity-empty">No notes recorded yet</p>)}
                {logTab === 'status' && (data.activity.length ? (
                  <ul className="activity-list">
                    {data.activity.map((entry) => (
                      <li key={entry.id}><span>{entry.message}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{activityTime(entry.createdAt)}</time></li>
                    ))}
                  </ul>
                ) : <p className="activity-empty">No status activity yet</p>)}
                {logTab === 'errors' && <p className="activity-empty">No errors recorded</p>}
              </div>
            </section>
          )}
          {error && <p className="plain-error">{error}</p>}
          <div className="settings-divider" />
          <div className="settings-extension-actions" aria-label="Get the Quadruzz extension">
            <div className="extension-version-status">
              <span>Installed version <strong>{data.installedExtensionVersion || 'Not detected'}</strong></span>
              <span>Available ZIP version <strong>{data.availableExtensionVersion || '0.1.0'}</strong></span>
            </div>
            {CHROME_STORE_URL
              ? <a className="settings-extension-action" href={CHROME_STORE_URL}>Install through Chrome Store</a>
              : <button className="settings-extension-action" type="button" disabled>Chrome Store page unavailable</button>}
            <a className="settings-extension-action" href="/api/extension-download" download>Download ZIP</a>
            {data.currentUser?.role === 'host' && (
              <div className="extension-upload-control">
                <label className={extensionUploadBusy ? 'disabled' : ''}>
                  <input type="file" accept=".zip,application/zip" disabled={extensionUploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadExtension(file); event.currentTarget.value = ''; }} />
                  {extensionUploadBusy ? 'Uploading extension ZIP…' : 'Upload extension ZIP'}
                </label>
                {extensionUploadMessage && <span>{extensionUploadMessage}</span>}
              </div>
            )}
          </div>
          <button className="sign-out" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </dialog>
      )}

      {!data.extensionEverSeen && !settingsOpen && (
        <aside className="extension-install-prompt" aria-label="Install Extension">
          <strong>Install Extension</strong>
          {CHROME_STORE_URL
            ? <a className="chrome-store-install" href={CHROME_STORE_URL}>Install through Chrome Store</a>
            : <button className="chrome-store-unavailable" type="button" disabled>Chrome Store page unavailable</button>}
          <a className="extension-zip-download" href="/api/extension-download" download>Download ZIP</a>
        </aside>
      )}

      <button ref={gearRef} className="gear" type="button" aria-label="Settings" title="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>
        <Settings aria-hidden="true" />
        {data.requests.length > 0 && <span className="gear-dot" aria-label={`${data.requests.length} pending request${data.requests.length === 1 ? '' : 's'}`} />}
      </button>
    </main>
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
