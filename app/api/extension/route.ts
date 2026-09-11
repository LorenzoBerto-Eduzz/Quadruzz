import { getDb } from '@/db';
import { authenticateExtension } from '@/lib/extension-auth';
import { expireStaleExtensionSessions, EXTENSION_ACTIVE_AFTER_MS } from '@/lib/extension-activity';
import { markOnline, markSessionClosed } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'cache-control': 'no-store, max-age=0' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
function validPresenceSessionId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}

export async function GET(request: Request) {
  try {
    const userId = await authenticateExtension(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const now = Date.now();
    await expireStaleExtensionSessions(now);
    const db = getDb();
    const members = (await db.prepare(`SELECT m.user_id AS userId,m.display_name AS displayName,m.updated_at AS imageVersion,m.acting_state AS actingState,m.note,MAX(e.last_seen_at) AS extensionLastSeen,MAX(CASE WHEN e.last_seen_at>=? THEN 1 ELSE 0 END) AS extensionActive FROM members m LEFT JOIN extension_sessions e ON e.user_id=m.user_id WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL GROUP BY m.user_id ORDER BY extensionActive DESC,m.join_order ASC`).bind(now - EXTENSION_ACTIVE_AFTER_MS).all()).results as Array<Record<string, unknown>>;
    const viewer = members.find((member) => member.userId === userId);
    if (viewer && Number(viewer.extensionLastSeen || 0) < now - 30_000) {
      await db.prepare('INSERT INTO extension_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at').bind(`reader:${userId}`, userId, now).run();
      viewer.extensionActive = 1;
      members.sort((a, b) => Number(Boolean(b.extensionActive)) - Number(Boolean(a.extensionActive)));
    }
    for (const member of members) delete member.extensionLastSeen;
    return reply({ currentUserId: userId, members });
  } catch { return reply({ error: 'Quadruzz is temporarily unavailable.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateExtension(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const body = await request.json() as { actingState?: string; note?: string | null; extensionAction?: 'heartbeat'; extensionSessionId?: string; presenceAction?: 'heartbeat' | 'leave'; presenceSessionId?: string };
    if (body.extensionAction === 'heartbeat') {
      const sessionId = body.extensionSessionId?.trim();
      if (!validPresenceSessionId(sessionId)) return reply({ error: 'Invalid extension session.' }, 400);
      await getDb().prepare('INSERT INTO extension_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at').bind(sessionId, userId, Date.now()).run();
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
    if (body.actingState !== undefined && body.actingState !== 'chat' && body.actingState !== 'ticket') return reply({ error: 'Invalid acting state.' }, 400);
    const note = body.note === undefined ? undefined : body.note?.trim() || null;
    if (note && note.length > 280) return reply({ error: 'Note must be 280 characters or fewer.' }, 400);
    if (body.actingState === undefined && body.note === undefined) return reply({ error: 'Nothing to update.' }, 400);
    const db = getDb();
    if (body.actingState !== undefined && body.note !== undefined) await db.prepare('UPDATE members SET acting_state=?,note=? WHERE user_id=?').bind(body.actingState, note, userId).run();
    else if (body.actingState !== undefined) await db.prepare('UPDATE members SET acting_state=? WHERE user_id=?').bind(body.actingState, userId).run();
    else await db.prepare('UPDATE members SET note=? WHERE user_id=?').bind(note, userId).run();
    return reply({ ok: true });
  } catch { return reply({ error: 'Update failed.' }, 400); }
}
