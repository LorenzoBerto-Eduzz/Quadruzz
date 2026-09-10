import { getDb, getFiles, configuredHostUserId } from '@/db';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import type { PendingRequest, PublicMember, Role, WorkspacePayload } from '@/lib/workspace-types';

const STALE_PRESENCE_AFTER_MS = 45_000;
const REQUEST_TTL_MS = 24 * 60 * 60_000;
let nextExpiredRequestCleanupAt = 0;

type MemberRow = { user_id: string; email: string; role: Role; status: string; join_order: number; display_name: string | null; profile_image_key: string | null; last_seen_at: number | null; updated_at: number; online?: number };
type RequestRow = { status: string; display_name: string | null; profile_image_key: string | null; expires_at: number | null };

async function finishPendingTestReset(): Promise<void> {
  const db = getDb();
  const pending = await db.prepare("SELECT value FROM board_state WHERE key='test_reset_pending'").first<{value: string}>();
  if (!pending) return;
  const objects = await getFiles().list({ prefix: 'profiles/' });
  const keys = objects.objects.map((item) => item.key);
  if (keys.length) await getFiles().delete(keys);
  const pendingObjects = await getFiles().list({ prefix: 'pending-profiles/' });
  const pendingKeys = pendingObjects.objects.map((item) => item.key);
  if (pendingKeys.length) await getFiles().delete(pendingKeys);
  await db.prepare("DELETE FROM board_state WHERE key='test_reset_pending'").run();
}

async function cleanupExpiredRequests(now: number): Promise<void> {
  if (now < nextExpiredRequestCleanupAt) return;
  nextExpiredRequestCleanupAt = now + 60_000;
  const db = getDb();
  const expired = (await db.prepare("SELECT profile_image_key FROM access_requests WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<=?").bind(now).all<{profile_image_key: string | null}>()).results;
  const keys = expired.flatMap((row) => row.profile_image_key ? [row.profile_image_key] : []);
  if (keys.length) {
    try { await getFiles().delete(keys); } catch { return; }
  }
  await db.prepare("DELETE FROM access_requests WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<=?").bind(now).run();
}

export function pendingRequestExpiresAt(now: number): number { return now + REQUEST_TTL_MS; }

export async function ensureConfiguredHost(user: ChatGPTUser): Promise<void> {
  const hostId = configuredHostUserId();
  if (!hostId || hostId !== user.userId) return;
  const db = getDb();
  await finishPendingTestReset();
  const existing = await db.prepare('SELECT email,role,status FROM members WHERE user_id=?').bind(user.userId).first<{email: string; role: Role; status: string}>();
  if (existing?.email === user.email && existing.role === 'host' && existing.status === 'approved') return;
  const now = Date.now();
  await db.prepare(`INSERT INTO members (user_id,email,role,status,join_order,display_name,profile_image_key,last_seen_at,created_at,updated_at)
    VALUES (?,?,'host','approved',1,NULL,NULL,?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, role='host', status='approved', updated_at=excluded.updated_at`)
    .bind(user.userId, user.email, now, now, now).run();
}

export async function getWorkspacePayload(user: ChatGPTUser): Promise<WorkspacePayload> {
  await ensureConfiguredHost(user);
  const now = Date.now();
  await cleanupExpiredRequests(now);
  const db = getDb();
  const member = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(user.userId).first<MemberRow>();
  const base = { currentUser: { userId: user.userId, email: user.email }, members: [], requests: [], boardTitle: 'Cross-Quadruzz' };
  if (!member || member.status !== 'approved') {
    const request = await db.prepare("SELECT status,display_name,profile_image_key,expires_at FROM access_requests WHERE user_id=? AND status='pending' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL AND expires_at>?").bind(user.userId, now).first<RequestRow>();
    if (request) return { ...base, accessState: 'pending', currentUser: { ...base.currentUser, displayName: request.display_name, pendingImageReceived: Boolean(request.profile_image_key) }, hostConfigurationRequired: !configuredHostUserId() };
    return { ...base, accessState: 'not_requested', hostConfigurationRequired: !configuredHostUserId() };
  }
  const currentUser = { userId: member.user_id, email: member.email, role: member.role, displayName: member.display_name, imageUrl: member.profile_image_key ? '/api/profile-image' : null };
  if (!member.display_name || !member.profile_image_key) return { ...base, accessState: 'onboarding', currentUser };

  const rows = (await db.prepare("SELECT m.user_id,m.email,m.role,m.status,m.join_order,m.display_name,m.profile_image_key,m.last_seen_at,m.updated_at,EXISTS(SELECT 1 FROM presence_sessions p WHERE p.user_id=m.user_id AND p.last_seen_at>=?) AS online FROM members m WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL ORDER BY m.join_order ASC").bind(now - STALE_PRESENCE_AFTER_MS).all<MemberRow>()).results;
  const members: PublicMember[] = rows.map((row) => ({ userId: row.user_id, displayName: row.display_name!, joinOrder: row.join_order, online: row.online === 1, imageUrl: `/api/profile-image?user=${encodeURIComponent(row.user_id)}&v=${row.updated_at}`, canRemove: member.role === 'host' && row.role !== 'host' && row.user_id !== member.user_id }));
  const requests = (await db.prepare("SELECT user_id AS userId,email,requested_at AS requestedAt FROM access_requests WHERE status='pending' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL AND expires_at>? ORDER BY requested_at ASC").bind(now).all<PendingRequest>()).results;
  const board = await db.prepare("SELECT value FROM board_state WHERE key='title'").first<{value: string}>();
  return { accessState: 'approved', currentUser, members, requests, boardTitle: board?.value || 'Cross-Quadruzz' };
}

export async function requireApproved(userId: string): Promise<MemberRow> {
  const member = await getDb().prepare("SELECT * FROM members WHERE user_id=? AND status='approved'").bind(userId).first<MemberRow>();
  if (!member) throw new Error('Access is not approved.');
  return member;
}
