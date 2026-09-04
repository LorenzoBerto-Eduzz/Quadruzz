'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, LogOut, Settings, Trash2, Upload, UserRoundPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Role, WorkspacePayload } from '@/lib/workspace-types';

async function api(path: string, init?: RequestInit): Promise<WorkspacePayload> {
  const response = await fetch(path, init); const data = await response.json() as WorkspacePayload & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export function WorkspaceApp() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { setData(await api('/api/workspace')); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Workspace unavailable.'); } }, []);
  const mutate = useCallback(async (path: string, body: Record<string, unknown>) => { setBusy(true); setError(''); try { const next = await api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setData(next); return next; } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); throw e; } finally { setBusy(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (data?.accessState !== 'approved') return;
    const heartbeat = () => void api('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat' }) }).then(setData).catch(() => undefined);
    heartbeat(); const timer = window.setInterval(heartbeat, 15_000); return () => window.clearInterval(timer);
  }, [data?.accessState]);
  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: 'request_cross_quadruzz_access', title: 'Request Cross-Quadruzz access', description: 'Submit the signed-in user access request and update the visible request status.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute() { const next = await mutate('/api/workspace', { action: 'request_access' }); return { status: next.accessState }; } }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [mutate]);

  if (!data) return <main className="status-shell"><div className="loader" /><p>{error || 'Opening Cross-Quadruzz…'}</p></main>;
  if (data.accessState === 'not_requested' || data.accessState === 'rejected') return <AccessRequest data={data} error={error} busy={busy} request={() => void mutate('/api/workspace', { action: 'request_access' })} />;
  if (data.accessState === 'pending') return <Pending email={data.currentUser?.email || ''} />;
  if (data.accessState === 'onboarding') return <ProfileForm title="Create your profile" description="Choose how your teammates will see you." data={data} error={error} busy={busy} onSave={async (name, file) => { await mutate('/api/workspace', { action: 'update_profile', displayName: name }); await upload(file); await refresh(); }} />;
  return <Board data={data} error={error} busy={busy} mutate={mutate} refresh={refresh} />;

  async function upload(file: File) { const form = new FormData(); form.set('image', file); const response = await fetch('/api/profile-image', { method: 'POST', body: form }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || 'Image upload failed.'); }
}

function AccessRequest({ data, error, busy, request }: { data: WorkspacePayload; error: string; busy: boolean; request: () => void }) {
  return <main className="status-shell"><section className="status-card"><div className="status-icon"><UserRoundPlus /></div><p className="eyebrow">Cross-Quadruzz</p><h1>Request access</h1><p>Send a request to the workspace team. Member and board details stay hidden until you are approved.</p>{data.ownerConfigurationRequired && <p className="configuration-note">Owner setup is still required before requests can be approved.</p>}{error && <p className="error-text">{error}</p>}<Button className="large-button" disabled={busy} onClick={request}>{busy ? 'Sending…' : data.accessState === 'rejected' ? 'Request again' : 'Request access'}</Button>{/* oxlint-disable-next-line next/no-html-link-for-pages */}<a className="quiet-link" href="/signout-with-chatgpt?return_to=/">Sign out</a></section></main>;
}

function Pending({ email }: { email: string }) { return <main className="status-shell"><section className="status-card"><div className="status-icon pending"><Clock3 /></div><p className="eyebrow">Request received</p><h1>Waiting for approval</h1><p>Your request is pending. You can return here later with the same ChatGPT account.</p><p className="account-label">{email}</p>{/* oxlint-disable-next-line next/no-html-link-for-pages */}<a className="quiet-link" href="/signout-with-chatgpt?return_to=/">Sign out</a></section></main>; }

function ProfileForm({ title, description, data, error, busy, onSave }: { title: string; description: string; data: WorkspacePayload; error: string; busy: boolean; onSave: (name: string, file: File) => Promise<void> }) {
  const [name, setName] = useState(data.currentUser?.displayName || ''); const [file, setFile] = useState<File | null>(null); const [localError, setLocalError] = useState('');
  return <main className="status-shell"><form className="status-card profile-form" onSubmit={(event) => { event.preventDefault(); if (!file) { setLocalError('Choose a profile image.'); return; } void onSave(name, file).catch((e) => setLocalError(e.message)); }}><div className="status-icon"><Upload /></div><p className="eyebrow">Profile</p><h1>{title}</h1><p>{description}</p><label htmlFor="profile-name">Display name</label><Input id="profile-name" value={name} maxLength={48} required onChange={(e) => setName(e.target.value)} /><label htmlFor="profile-image">Profile image</label><Input id="profile-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={(e) => setFile(e.target.files?.[0] || null)} />{(localError || error) && <p className="error-text">{localError || error}</p>}<Button className="large-button" disabled={busy} type="submit">{busy ? 'Saving…' : 'Enter workspace'}</Button></form></main>;
}

function Board({ data, error, busy, mutate, refresh }: { data: WorkspacePayload; error: string; busy: boolean; mutate: (path: string, body: Record<string, unknown>) => Promise<WorkspacePayload>; refresh: () => Promise<void> }) {
  const me = data.currentUser!; const isAdmin = me.role === 'owner' || me.role === 'admin';
  return <main className="board-shell"><header className="board-header"><div><p className="eyebrow">Private workspace</p><h1>{data.boardTitle}</h1></div><p className="presence-summary"><span />{data.members.filter((m) => m.online).length} online · {data.members.length} members</p></header><section className="member-grid" aria-label="Members">{data.members.map((member) => <article className={`member-card ${member.online ? '' : 'offline'}`} key={member.userId}><Avatar className="member-avatar"><AvatarImage src={member.imageUrl} alt="" /><AvatarFallback>{initials(member.displayName)}</AvatarFallback></Avatar><div><h2>{member.displayName}</h2><p>{member.online ? 'Online' : 'Offline'}{member.role !== 'member' ? ` · ${member.role}` : ''}</p></div></article>)}</section>{error && <p className="floating-error">{error}</p>}<SettingsPanel data={data} busy={busy} isAdmin={isAdmin} mutate={mutate} refresh={refresh} /></main>;
}

function SettingsPanel({ data, busy, isAdmin, mutate, refresh }: { data: WorkspacePayload; busy: boolean; isAdmin: boolean; mutate: (path: string, body: Record<string, unknown>) => Promise<WorkspacePayload>; refresh: () => Promise<void> }) {
  const [name, setName] = useState(data.currentUser?.displayName || ''); const [title, setTitle] = useState(data.boardTitle); const [image, setImage] = useState<File | null>(null);
  async function saveProfile() { await mutate('/api/workspace', { action: 'update_profile', displayName: name }); if (image) { const form = new FormData(); form.set('image', image); const r = await fetch('/api/profile-image', { method: 'POST', body: form }); if (!r.ok) throw new Error('Image upload failed.'); } await refresh(); }
  return <Sheet><SheetTrigger render={<Button className="settings-button" size="icon-lg" aria-label="Open settings"><Settings /></Button>} /><SheetContent className="settings-sheet"><SheetHeader><SheetTitle>Settings</SheetTitle><SheetDescription>Manage your Cross-Quadruzz profile and workspace access.</SheetDescription></SheetHeader><div className="settings-body"><section><h3>Your profile</h3><label htmlFor="settings-name">Display name</label><Input id="settings-name" value={name} maxLength={48} onChange={(e) => setName(e.target.value)} /><label htmlFor="settings-image">New profile image</label><Input id="settings-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImage(e.target.files?.[0] || null)} /><Button disabled={busy} onClick={() => void saveProfile()}>Save profile</Button></section>{isAdmin && <section><h3>Access requests</h3>{data.requests.length === 0 ? <p className="empty-note">No pending requests.</p> : data.requests.map((request) => <div className="request-row" key={request.userId}><span>{request.email}</span><div><Button size="icon-sm" aria-label={`Approve ${request.email}`} onClick={() => void mutate('/api/admin', { action: 'approve', userId: request.userId })}><Check /></Button><Button variant="ghost" size="icon-sm" aria-label={`Reject ${request.email}`} onClick={() => void mutate('/api/admin', { action: 'reject', userId: request.userId })}><X /></Button></div></div>)}</section>}{isAdmin && <section><h3>Board</h3><label htmlFor="board-title">Board title</label><Input id="board-title" value={title} maxLength={64} onChange={(e) => setTitle(e.target.value)} /><Button variant="outline" onClick={() => void mutate('/api/admin', { action: 'set_board_title', title })}>Save board title</Button></section>}{isAdmin && <section><h3>Members</h3>{data.members.filter((m) => m.userId !== data.currentUser?.userId).map((member) => <div className="request-row" key={member.userId}><span>{member.displayName}<small>{member.role}</small></span><div>{data.currentUser?.role === 'owner' && <Button variant="ghost" size="sm" onClick={() => void mutate('/api/admin', { action: 'set_role', userId: member.userId, role: member.role === 'admin' ? 'member' : 'admin' as Role })}>{member.role === 'admin' ? 'Demote' : 'Make admin'}</Button>}<Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.displayName}`} onClick={() => void mutate('/api/admin', { action: 'remove_member', userId: member.userId })}><Trash2 /></Button></div></div>)}</section>}<section className="danger-zone"><h3>Account</h3><Button variant="outline" onClick={() => void mutate('/api/workspace', { action: 'reset_profile' })}>Reset profile</Button>{data.currentUser?.role !== 'owner' && <Confirm title="Delete your profile?" description="This removes your profile and revokes workspace access." action="Delete profile" onConfirm={() => void mutate('/api/workspace', { action: 'delete_profile' })} />}{/* oxlint-disable-next-line next/no-html-link-for-pages */}<a className="signout-button" href="/signout-with-chatgpt?return_to=/"><LogOut /> Sign out</a></section>{data.currentUser?.role === 'owner' && <section className="danger-zone"><h3>Owner tools</h3><Confirm title="Clear test data?" description="This removes every non-owner member, request, board setting, and associated profile image." action="Clear test data" onConfirm={() => void mutate('/api/admin', { action: 'clear_test_data' })} /></section>}</div></SheetContent></Sheet>;
}

function Confirm({ title, description, action, onConfirm }: { title: string; description: string; action: string; onConfirm: () => void }) { return <AlertDialog><AlertDialogTrigger render={<Button variant="destructive"><Trash2 />{action}</Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>{action}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>; }
function initials(name: string) { return name.split(/\s+/).slice(0,2).map((part) => part[0]?.toUpperCase()).join(''); }


