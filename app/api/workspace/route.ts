import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { ensureConfiguredHost, getWorkspacePayload, requireApproved } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'no-store, max-age=0' } }); }

function validPresenceSessionId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}

async function touchPresence(userId: string, sessionId: string, now: number) {
  await getDb().batch([
    getDb().prepare('INSERT INTO presence_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at').bind(sessionId, userId, now),
    getDb().prepare('DELETE FROM presence_sessions WHERE last_seen_at<?').bind(now - 45_000),
  ]);
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: 'Authentication required.' }, 401);
  try {
    await ensureConfiguredHost(user);
    const sessionId = new URL(request.url).searchParams.get('presenceSessionId');
    if (validPresenceSessionId(sessionId)) {
      try { await requireApproved(user.userId); await touchPresence(user.userId, sessionId, Date.now()); }
      catch { /* Unapproved visitors do not create presence sessions. */ }
    }
    return reply(await getWorkspacePayload(user));
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Workspace unavailable.' }, 503); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: 'Authentication required.' }, 401);
  try {
    await ensureConfiguredHost(user);
    const body = await request.json() as { action?: string; displayName?: string; presenceSessionId?: string };
    const db = getDb(); const now = Date.now();
    if (body.action === 'heartbeat') {
      await requireApproved(user.userId);
      const sessionId = body.presenceSessionId?.trim();
      if (!validPresenceSessionId(sessionId)) return reply({ error: 'Invalid presence session.' }, 400);
      await touchPresence(user.userId, sessionId, now);
      return reply({ ok: true });
    } else if (body.action === 'leave_all') {
      await requireApproved(user.userId);
      await db.prepare('DELETE FROM presence_sessions WHERE user_id=?').bind(user.userId).run();
      return reply({ ok: true });
    } else if (body.action === 'leave') {
      const sessionId = body.presenceSessionId?.trim();
      if (sessionId) await db.prepare('DELETE FROM presence_sessions WHERE session_id=? AND user_id=?').bind(sessionId, user.userId).run();
      return reply({ ok: true });
    } else if (body.action === 'update_profile') {
      await requireApproved(user.userId);
      const displayName = body.displayName?.trim();
      if (!displayName || displayName.length > 48) return reply({ error: 'Display name must be 1–48 characters.' }, 400);
      await db.prepare('UPDATE members SET display_name=?,last_seen_at=?,updated_at=? WHERE user_id=?').bind(displayName, now, now, user.userId).run();
    } else if (body.action === 'reset_profile') {
      const member = await requireApproved(user.userId);
      if (member.profile_image_key) await getFiles().delete(member.profile_image_key);
      await db.prepare('UPDATE members SET display_name=NULL,profile_image_key=NULL,last_seen_at=NULL,updated_at=? WHERE user_id=?').bind(now, user.userId).run();
    } else if (body.action === 'delete_profile') {
      const member = await requireApproved(user.userId);
      if (member.role === 'host') return reply({ error: 'The permanent host profile cannot be deleted.' }, 400);
      if (member.profile_image_key) await getFiles().delete(member.profile_image_key);
      await db.batch([
        db.prepare("UPDATE members SET status='removed',display_name=NULL,profile_image_key=NULL,last_seen_at=NULL,updated_at=? WHERE user_id=?").bind(now, user.userId),
        db.prepare('DELETE FROM access_requests WHERE user_id=?').bind(user.userId),
        db.prepare('DELETE FROM presence_sessions WHERE user_id=?').bind(user.userId),
      ]);
    } else return reply({ error: 'Unknown action.' }, 400);
    return reply(await getWorkspacePayload(user));
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Request failed.' }, 400); }
}
