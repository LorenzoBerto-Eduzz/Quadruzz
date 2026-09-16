import { getDb } from '@/db';
import { authenticateExtensionIdentity } from '@/lib/extension-auth';
import { expireStaleExtensionSessions, EXTENSION_ACTIVE_AFTER_MS, EXTENSION_READER_REFRESH_MS } from '@/lib/extension-activity';
import { markOnline, markSessionClosed } from '@/lib/activity-log';
import { recordError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'cache-control': 'no-store, max-age=0' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
function validPresenceSessionId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}
function validExtensionVersion(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(value);
}
function normalizeRoleStatus(value: unknown): { key: string; label: string } | null {
  if (typeof value !== 'string') return null;
  const label = value.trim().replace(/\s+/g, ' ');
  const hasControlCharacter = Array.from(label).some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127; });
  if (!label || label.length > 30 || hasControlCharacter) return null;
  return { key: label.toLocaleLowerCase('en-US'), label };
}

export async function GET(request: Request) {
  try {
    const userId = await authenticateExtensionIdentity(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const now = Date.now();
    const db = getDb();
    const approved = await db.prepare("SELECT 1 FROM members WHERE user_id=? AND status='approved'").bind(userId).first();
    if (!approved) {
      const pending = await db.prepare("SELECT 1 FROM access_requests WHERE user_id=? AND status='pending' AND display_name IS NOT NULL AND profile_image_key IS NOT NULL AND expires_at>?").bind(userId, now).first();
      return reply({ accessState: pending ? 'pending' : 'not_requested' });
    }
    await expireStaleExtensionSessions(now);
    const members = (await db.prepare(`SELECT m.user_id AS userId,m.display_name AS displayName,m.updated_at AS imageVersion,m.acting_state AS actingState,m.note,m.note_updated_at AS noteUpdatedAt,MAX(e.last_seen_at) AS extensionLastSeen,MAX(CASE WHEN e.last_seen_at>=? THEN 1 ELSE 0 END) AS extensionActive FROM members m LEFT JOIN extension_sessions e ON e.user_id=m.user_id WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL GROUP BY m.user_id ORDER BY extensionActive DESC,m.join_order ASC`).bind(now - EXTENSION_ACTIVE_AFTER_MS).all()).results as Array<Record<string, unknown>>;
    const viewer = members.find((member) => member.userId === userId);
    if (viewer && Number(viewer.extensionLastSeen || 0) < now - EXTENSION_READER_REFRESH_MS) {
      await db.prepare('INSERT INTO extension_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at').bind(`reader:${userId}`, userId, now).run();
      viewer.extensionActive = 1;
      members.sort((a, b) => Number(Boolean(b.extensionActive)) - Number(Boolean(a.extensionActive)));
    }
    for (const member of members) delete member.extensionLastSeen;
    const roleStatuses = (await db.prepare('SELECT label FROM role_statuses ORDER BY label COLLATE NOCASE, key').all<{ label: string }>()).results.map((row) => row.label);
    return reply({ accessState: 'approved', currentUserId: userId, members, roleStatuses });
  } catch (error) { await recordError('Extension synchronization', error); return reply({ error: 'Quadruzz is temporarily unavailable.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateExtensionIdentity(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const member = await getDb().prepare("SELECT display_name,acting_state FROM members WHERE user_id=? AND status='approved'").bind(userId).first<{ display_name: string | null; acting_state: string }>();
    if (!member) return reply({ error: 'Approved membership required.' }, 403);
    const body = await request.json() as { actingState?: string; createActingState?: boolean; note?: string | null; extensionAction?: 'heartbeat'; extensionSessionId?: string; extensionVersion?: string; presenceAction?: 'heartbeat' | 'leave'; presenceSessionId?: string };
    if (body.extensionAction === 'heartbeat') {
      const sessionId = body.extensionSessionId?.trim();
      if (!validPresenceSessionId(sessionId)) return reply({ error: 'Invalid extension session.' }, 400);
      const extensionVersion = validExtensionVersion(body.extensionVersion) ? body.extensionVersion : null;
      await getDb().prepare('INSERT INTO extension_sessions (session_id,user_id,last_seen_at,extension_version) VALUES (?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at,extension_version=COALESCE(excluded.extension_version,extension_sessions.extension_version)').bind(sessionId, userId, Date.now(), extensionVersion).run();
      if (!body.presenceAction) return reply({ ok: true });
    }
    if (body.presenceAction) {
      const sessionId = body.presenceSessionId?.trim();
      if (!validPresenceSessionId(sessionId)) return reply({ error: 'Invalid presence session.' }, 400);
      const member = await getDb().prepare("SELECT display_name FROM members WHERE user_id=? AND status='approved'").bind(userId).first<{ display_name: string | null }>();
      if (!member) return reply({ error: 'Approved membership required.' }, 403);
      const now = Date.now();
      if (body.presenceAction === 'heartbeat') await markOnline(userId, sessionId, member.display_name || 'Member', now);
      else await markSessionClosed(userId, sessionId, member.display_name || 'Member', now);
      return reply({ ok: true });
    }
    const note = body.note === undefined
      ? undefined
      : body.note?.trim().replace(/\r\n?/g, '\n') || null;
    if (body.actingState === undefined && body.note === undefined) return reply({ error: 'Nothing to update.' }, 400);
    const db = getDb();
    let actingState: string | undefined;
    if (body.actingState !== undefined) {
      const normalized = normalizeRoleStatus(body.actingState);
      if (!normalized) return reply({ error: 'Role status must be 1–30 characters.' }, 400);
      if (body.createActingState) {
        await db.prepare('INSERT OR IGNORE INTO role_statuses (key,label,created_by,created_at) VALUES (?,?,?,?)').bind(normalized.key, normalized.label, userId, Date.now()).run();
      }
      const roleStatus = await db.prepare('SELECT label FROM role_statuses WHERE key=?').bind(normalized.key).first<{ label: string }>();
      if (!roleStatus) return reply({ error: 'Unknown role status.' }, 400);
      actingState = roleStatus.label;
    }
    const noteUpdatedAt = body.note === undefined ? undefined : Date.now();
    const updates = actingState !== undefined && body.note !== undefined
      ? [db.prepare('UPDATE members SET acting_state=?,note=?,note_updated_at=? WHERE user_id=?').bind(actingState, note, noteUpdatedAt, userId)]
      : actingState !== undefined
        ? [db.prepare('UPDATE members SET acting_state=? WHERE user_id=?').bind(actingState, userId)]
        : [db.prepare('UPDATE members SET note=?,note_updated_at=? WHERE user_id=?').bind(note, noteUpdatedAt, userId)];
    if (actingState !== undefined && actingState !== member.acting_state) {
      updates.push(
        db.prepare('INSERT INTO role_log (user_id,display_name,old_role,new_role,created_at) VALUES (?,?,?,?,?)').bind(userId, member.display_name || 'Member', member.acting_state, actingState, noteUpdatedAt || Date.now()),
        db.prepare('DELETE FROM role_log WHERE id NOT IN (SELECT id FROM role_log ORDER BY created_at DESC,id DESC LIMIT 100)'),
      );
    }
    if (note !== undefined && note !== null) {
      updates.push(
        db.prepare('INSERT INTO note_log (user_id,display_name,note,created_at) VALUES (?,?,?,?)').bind(userId, member.display_name || 'Member', note, noteUpdatedAt || Date.now()),
        db.prepare('DELETE FROM note_log WHERE id NOT IN (SELECT id FROM note_log ORDER BY created_at DESC,id DESC LIMIT 100)'),
      );
    }
    await db.batch(updates);
    return reply({ ok: true, actingState, note, noteUpdatedAt });
  } catch (error) { await recordError('Extension update', error); return reply({ error: 'Update failed.' }, 400); }
}
