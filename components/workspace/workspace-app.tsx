'use client';
/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import type { WorkspacePayload } from '@/lib/workspace-types';

async function api(init?: RequestInit): Promise<WorkspacePayload> {
  const response = await fetch('/api/workspace', init);
  const data = await response.json() as WorkspacePayload & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export function WorkspaceApp() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setData(await api()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Workspace unavailable.'); }
  }, []);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setError('');
    try {
      const next = await api({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      setData(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (data?.accessState !== 'approved') return;
    const pulse = () => void act('heartbeat');
    pulse(); const timer = window.setInterval(pulse, 15_000);
    return () => window.clearInterval(timer);
  }, [act, data?.accessState]);

  if (!data) return <main className="gate"><span>{error || 'Loading…'}</span></main>;
  if (data.accessState === 'not_requested' || data.accessState === 'rejected') {
    return <main className="gate"><button className="plain-action" disabled={busy} onClick={() => void act('request_access')}>{busy ? 'Sending…' : 'Request access'}</button>{error && <span className="plain-error">{error}</span>}</main>;
  }
  if (data.accessState === 'pending') return <main className="gate"><span>Waiting for approval</span></main>;
  if (data.accessState === 'onboarding') return <ProfileSetup data={data} refresh={refresh} act={act} busy={busy} error={error} />;

  const presentMembers = data.members.filter((member) => member.online);
  return (
    <main className="quadro">
      <div className="people" aria-label="People currently present">
        {presentMembers.map((member) => (
          <img className="person" src={member.imageUrl} alt={member.displayName} title={member.displayName} key={member.userId} />
        ))}
      </div>
      <button className="gear" type="button" aria-label="Settings" title="Settings"><Settings aria-hidden="true" /></button>
    </main>
  );
}

function ProfileSetup({ data, refresh, act, busy, error }: { data: WorkspacePayload; refresh: () => Promise<void>; act: (action: string, extra?: Record<string, unknown>) => Promise<void>; busy: boolean; error: string }) {
  const [name, setName] = useState(data.currentUser?.displayName || '');
  const [image, setImage] = useState<File | null>(null);
  const [localError, setLocalError] = useState('');
  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!image) { setLocalError('Choose an image.'); return; }
    await act('update_profile', { displayName: name });
    const form = new FormData(); form.set('image', image);
    const response = await fetch('/api/profile-image', { method: 'POST', body: form });
    if (!response.ok) { const result = await response.json() as { error?: string }; setLocalError(result.error || 'Image upload failed.'); return; }
    await refresh();
  }
  return (
    <main className="gate">
      <form className="profile-setup" onSubmit={(event) => void submit(event)}>
        <input aria-label="Display name" value={name} maxLength={48} placeholder="Display name" required onChange={(event) => setName(event.target.value)} />
        <input aria-label="Profile image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={(event) => setImage(event.target.files?.[0] || null)} />
        <button className="plain-action" disabled={busy} type="submit">Enter</button>
        {(localError || error) && <span className="plain-error">{localError || error}</span>}
      </form>
    </main>
  );
}



