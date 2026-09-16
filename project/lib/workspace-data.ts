import { getDb, getFiles, configuredHostUserId } from '@/db';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { listActivity } from '@/lib/activity-log';
import { expireStaleExtensionSessions, EXTENSION_ACTIVE_AFTER_MS } from '@/lib/extension-activity';
import { recordError } from '@/lib/error-log';
import type { ErrorLogEntry, NoteLogEntry, PendingRequest, PublicMember, Role, RoleLogEntry, WorkspacePayload } from '@/lib/workspace-types';

const REQUEST_TTL_MS = 24 * 60 * 60_000;
let nextExpiredRequestCleanupAt = 0;

type MemberRow = { user_id: string; email: string; role: Role; status: string; join_order: number; display_name: string | null; profile_image_key: string | null; last_seen_at: number | null; updated_at: number; extension_active?: number };
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
    try { await getFiles().delete(keys); } catch (error) { await recordError('Expired profile cleanup warning', error); return; }
  }
  await db.prepare("DELETE FROM access_requests WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<=?").bind(now).run();
}

export function pendingRequestExpiresAt(now: number): number { return now + REQUEST_TTL_MS; }

export async function ensureConfiguredHost(user: ChatGPTUser): Promise<void> {
  const hostId = configuredHostUserId();
  if (!hostId) return;
  const db = getDb();
  await finishPendingTestReset();
  const existing = await db.prepare('SELECT email,role,status,join_order,display_name,profile_image_key FROM members WHERE user_id=?').bind(hostId).first<{email: string; role: Role; status: string; join_order: number; display_name: string | null; profile_image_key: string | null}>();
  const pending = await db.prepare("SELECT email,display_name,profile_image_key FROM access_requests WHERE user_id=? AND status='pending'").bind(hostId).first<{email: string; display_name: string | null; profile_image_key: string | null}>();
  const email = existing?.email || pending?.email || (hostId === user.userId ? user.email : null);
  if (!email) return;
  const otherHost = await db.prepare("SELECT 1 AS found FROM members WHERE role='host' AND user_id!=? LIMIT 1").bind(hostId).first<{ found: number }>();
  if (existing?.email === email && existing.role === 'host' && existing.status === 'approved' && !otherHost && !pending) return;
  const now = Date.now();
  const next = existing ? existing.join_order : (await db.prepare('SELECT COALESCE(MAX(join_order),0)+1 AS value FROM members').first<{ value: number }>())?.value || 1;
  await db.batch([
    db.prepare("UPDATE members SET role='member',updated_at=? WHERE role='host' AND user_id!=?").bind(now, hostId),
    db.prepare(`INSERT INTO members (user_id,email,role,status,join_order,display_name,profile_image_key,acting_state,last_seen_at,created_at,updated_at)
      VALUES (?,?,'host','approved',?,?,?,'',NULL,?,?)
      ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,role='host',status='approved',display_name=COALESCE(members.display_name,excluded.display_name),profile_image_key=COALESCE(members.profile_image_key,excluded.profile_image_key),updated_at=excluded.updated_at`)
      .bind(hostId, email, next, existing?.display_name || pending?.display_name || null, existing?.profile_image_key || pending?.profile_image_key || null, now, now),
    db.prepare('DELETE FROM access_requests WHERE user_id=?').bind(hostId),
  ]);
}

export async function getWorkspacePayload(user: ChatGPTUser): Promise<WorkspacePayload> {
  await ensureConfiguredHost(user);
  const now = Date.now();
  await cleanupExpiredRequests(now);
  const db = getDb();
  const member = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(user.userId).first<MemberRow>();
  const base = { currentUser: { userId: user.userId, email: user.email }, members: [], requests: [], activity: [], noteLog: [], roleLog: [], errorLog: [], roleStatuses: [], boardTitle: 'Cross-Quadruzz', installedExtensionVersion: null, availableExtensionVersion: '0.1.0' };
  if (!member || member.status !== 'approved') {
    const request = await db.prepare("SELECT status,display_name,profile_image_key,expires_at FROM access_requests WHERE user_id=? AND status='pending' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL AND expires_at>?").bind(user.userId, now).first<RequestRow>();
    if (request) return { ...base, accessState: 'pending', currentUser: { ...base.currentUser, displayName: request.display_name, imageUrl: `/api/profile-image?pending=1&v=${request.expires_at || now}`, pendingImageReceived: Boolean(request.profile_image_key) }, hostConfigurationRequired: !configuredHostUserId() };
    return { ...base, accessState: 'not_requested', hostConfigurationRequired: !configuredHostUserId() };
  }
  const currentUser = { userId: member.user_id, email: member.email, role: member.role, displayName: member.display_name, imageUrl: member.profile_image_key ? '/api/profile-image' : null };
  if (!member.display_name || !member.profile_image_key) return { ...base, accessState: 'onboarding', currentUser };

  await expireStaleExtensionSessions(now);
  const extensionHistory = await db.prepare('SELECT 1 AS seen FROM extension_credentials WHERE user_id=? LIMIT 1').bind(user.userId).first<{ seen: number }>();
  const installedExtension = await db.prepare('SELECT extension_version AS version FROM extension_sessions WHERE user_id=? AND extension_version IS NOT NULL AND last_seen_at>=? ORDER BY last_seen_at DESC LIMIT 1').bind(user.userId, now - EXTENSION_ACTIVE_AFTER_MS).first<{ version: string }>();
  const rows = (await db.prepare("SELECT m.user_id,m.email,m.role,m.status,m.join_order,m.display_name,m.profile_image_key,m.last_seen_at,m.updated_at,EXISTS(SELECT 1 FROM extension_sessions e WHERE e.user_id=m.user_id AND e.last_seen_at>=?) AS extension_active FROM members m WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL ORDER BY extension_active DESC,m.join_order ASC").bind(now - EXTENSION_ACTIVE_AFTER_MS).all<MemberRow>()).results;
  const members: PublicMember[] = rows.map((row) => ({ userId: row.user_id, displayName: row.display_name!, joinOrder: row.join_order, extensionActive: row.extension_active === 1, imageUrl: `/api/profile-image?user=${encodeURIComponent(row.user_id)}&v=${row.updated_at}`, canRemove: member.role === 'host' && row.role !== 'host' && row.user_id !== member.user_id }));
  const requests = (await db.prepare("SELECT user_id AS userId,email,requested_at AS requestedAt FROM access_requests WHERE status='pending' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL AND expires_at>? ORDER BY requested_at ASC").bind(now).all<PendingRequest>()).results;
  const board = await db.prepare("SELECT value FROM board_state WHERE key='title'").first<{value: string}>();
  const availableExtension = await db.prepare("SELECT value FROM board_state WHERE key='extension_zip_version'").first<{value: string}>();
  const activity = await listActivity();
  const noteLog = (await db.prepare('SELECT id,display_name AS displayName,note,created_at AS createdAt FROM note_log ORDER BY created_at DESC,id DESC LIMIT 100').all<NoteLogEntry>()).results;
  const roleLog = (await db.prepare('SELECT id,display_name AS displayName,old_role AS oldRole,new_role AS newRole,created_at AS createdAt FROM role_log ORDER BY created_at DESC,id DESC LIMIT 100').all<RoleLogEntry>()).results;
  const errorLog = (await db.prepare('SELECT id,message,created_at AS createdAt FROM error_log ORDER BY created_at DESC,id DESC LIMIT 100').all<ErrorLogEntry>()).results;
  const roleStatuses = (await db.prepare('SELECT label FROM role_statuses ORDER BY label COLLATE NOCASE, key').all<{ label: string }>()).results.map((row) => row.label);
  return { accessState: 'approved', currentUser, members, requests, activity, noteLog, roleLog, errorLog, roleStatuses, boardTitle: board?.value || 'Cross-Quadruzz', extensionEverSeen: Boolean(extensionHistory), installedExtensionVersion: installedExtension?.version || null, availableExtensionVersion: availableExtension?.value || '0.1.0' };
}

export async function requireApproved(userId: string): Promise<MemberRow> {
  const member = await getDb().prepare("SELECT * FROM members WHERE user_id=? AND status='approved'").bind(userId).first<MemberRow>();
  if (!member) throw new Error('Access is not approved.');
  return member;
}
