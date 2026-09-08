import { getDb, configuredOwnerUserId } from '@/db';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import type { PendingRequest, PublicMember, Role, WorkspacePayload } from '@/lib/workspace-types';

const OFFLINE_AFTER_MS = 45_000;

type MemberRow = { user_id: string; email: string; role: Role; status: string; join_order: number; display_name: string | null; profile_image_key: string | null; last_seen_at: number | null };

export async function ensureConfiguredOwner(user: ChatGPTUser): Promise<void> {
  const ownerId = configuredOwnerUserId();
  if (!ownerId || ownerId !== user.userId) return;
  const db = getDb();
  const existing = await db.prepare('SELECT email,role,status FROM members WHERE user_id=?').bind(user.userId).first<{email: string; role: Role; status: string}>();
  if (existing?.email === user.email && existing.role === 'owner' && existing.status === 'approved') return;
  const now = Date.now();
  await db.prepare(`INSERT INTO members (user_id,email,role,status,join_order,display_name,profile_image_key,last_seen_at,created_at,updated_at)
    VALUES (?,?,'owner','approved',1,NULL,NULL,?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, role='owner', status='approved', updated_at=excluded.updated_at`)
    .bind(user.userId, user.email, now, now, now).run();
}

export async function getWorkspacePayload(user: ChatGPTUser): Promise<WorkspacePayload> {
  await ensureConfiguredOwner(user);
  const db = getDb();
  const member = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(user.userId).first<MemberRow>();
  const base = { currentUser: { userId: user.userId, email: user.email }, members: [], requests: [], boardTitle: 'Cross-Quadruzz' };
  if (!member || member.status !== 'approved') {
    const request = await db.prepare('SELECT status FROM access_requests WHERE user_id = ?').bind(user.userId).first<{status: string}>();
    const accessState = request?.status === 'pending' ? 'pending' : request?.status === 'rejected' ? 'rejected' : 'not_requested';
    return { ...base, accessState, ownerConfigurationRequired: !configuredOwnerUserId() };
  }
  const currentUser = { userId: member.user_id, email: member.email, role: member.role, displayName: member.display_name, imageUrl: member.profile_image_key ? '/api/profile-image' : null };
  if (!member.display_name || !member.profile_image_key) return { ...base, accessState: 'onboarding', currentUser };

  const rows = (await db.prepare("SELECT user_id,email,role,status,join_order,display_name,profile_image_key,last_seen_at FROM members WHERE status='approved' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL ORDER BY join_order ASC").all<MemberRow>()).results;
  const now = Date.now();
  const ownerCanSeeRoles = member.role === 'owner';
  const members: PublicMember[] = rows.map((row) => ({ userId: row.user_id, displayName: row.display_name!, joinOrder: row.join_order, online: row.last_seen_at !== null && now - row.last_seen_at <= OFFLINE_AFTER_MS, imageUrl: `/api/profile-image?user=${encodeURIComponent(row.user_id)}`, ...(ownerCanSeeRoles ? { role: row.role } : {}) }));
  let requests: PendingRequest[] = [];
  if (member.role === 'owner' || member.role === 'admin') requests = (await db.prepare("SELECT user_id AS userId,email,requested_at AS requestedAt FROM access_requests WHERE status='pending' ORDER BY requested_at ASC").all<PendingRequest>()).results;
  const board = await db.prepare("SELECT value FROM board_state WHERE key='title'").first<{value: string}>();
  return { accessState: 'approved', currentUser, members, requests, boardTitle: board?.value || 'Cross-Quadruzz' };
}

export async function requireApproved(userId: string): Promise<MemberRow> {
  const member = await getDb().prepare("SELECT * FROM members WHERE user_id=? AND status='approved'").bind(userId).first<MemberRow>();
  if (!member) throw new Error('Access is not approved.');
  return member;
}

export async function requireAdmin(userId: string): Promise<MemberRow> {
  const member = await requireApproved(userId);
  if (member.role !== 'owner' && member.role !== 'admin') throw new Error('Administrator access is required.');
  return member;
}
