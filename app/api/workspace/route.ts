import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { ensureConfiguredOwner, getWorkspacePayload, requireApproved } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

function reply(data: unknown, status = 200) { return Response.json(data, { status }); }

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: 'Authentication required.' }, 401);
  try { return reply(await getWorkspacePayload(user)); }
  catch (error) { return reply({ error: error instanceof Error ? error.message : 'Workspace unavailable.' }, 503); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: 'Authentication required.' }, 401);
  try {
    await ensureConfiguredOwner(user);
    const body = await request.json() as { action?: string; displayName?: string };
    const db = getDb(); const now = Date.now();
    if (body.action === 'request_access') {
      await db.prepare(`INSERT INTO access_requests (user_id,email,status,requested_at,decided_at,decided_by) VALUES (?,?,'pending',?,NULL,NULL)
        ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,status='pending',requested_at=excluded.requested_at,decided_at=NULL,decided_by=NULL`)
        .bind(user.userId, user.email, now).run();
    } else if (body.action === 'heartbeat') {
      await requireApproved(user.userId);
      await db.prepare('UPDATE members SET last_seen_at=?,updated_at=? WHERE user_id=?').bind(now, now, user.userId).run();
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
      if (member.role === 'owner') return reply({ error: 'The permanent owner profile cannot be deleted.' }, 400);
      if (member.profile_image_key) await getFiles().delete(member.profile_image_key);
      await db.batch([
        db.prepare("UPDATE members SET status='removed',display_name=NULL,profile_image_key=NULL,last_seen_at=NULL,updated_at=? WHERE user_id=?").bind(now, user.userId),
        db.prepare('DELETE FROM access_requests WHERE user_id=?').bind(user.userId),
      ]);
    } else return reply({ error: 'Unknown action.' }, 400);
    return reply(await getWorkspacePayload(user));
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Request failed.' }, 400); }
}
