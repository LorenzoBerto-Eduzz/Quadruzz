import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { getWorkspacePayload, requireApproved } from '@/lib/workspace-data';
import type { Role } from '@/lib/workspace-types';
import { recordActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

type PendingProfile = { email: string; display_name: string; profile_image_key: string; expires_at: number };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const actor = await requireApproved(user.userId);
    const body = await request.json() as { action?: string; userId?: string; title?: string };
    const db = getDb(); const now = Date.now(); const targetId = body.userId?.trim();
    if (body.action === 'approve') {
      if (!targetId) throw new Error('User is required.');
      const pending = await db.prepare("SELECT email,display_name,profile_image_key,expires_at FROM access_requests WHERE user_id=? AND status='pending' AND expires_at>?").bind(targetId, now).first<PendingProfile>();
      if (!pending?.display_name || !pending.profile_image_key) throw new Error('Pending request is incomplete or expired.');
      const next = await db.prepare('SELECT COALESCE(MAX(join_order),0)+1 AS value FROM members').first<{value: number}>();
      await db.batch([
        db.prepare(`INSERT INTO members (user_id,email,role,status,join_order,display_name,profile_image_key,acting_state,last_seen_at,created_at,updated_at) VALUES (?,?,'member','approved',?,?,?,'',NULL,?,?)
          ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,role='member',status='approved',display_name=excluded.display_name,profile_image_key=excluded.profile_image_key,acting_state=excluded.acting_state,last_seen_at=NULL,updated_at=excluded.updated_at`).bind(targetId, pending.email, next?.value || 1, pending.display_name, pending.profile_image_key, now, now),
        db.prepare('DELETE FROM access_requests WHERE user_id=?').bind(targetId),
      ]);
      await recordActivity(`${actor.display_name || user.email} approved ${pending.display_name}`, now);
    } else if (body.action === 'reject') {
      if (!targetId) throw new Error('User is required.');
      const pending = await db.prepare("SELECT display_name,profile_image_key FROM access_requests WHERE user_id=? AND status='pending'").bind(targetId).first<{display_name: string | null; profile_image_key: string | null}>();
      if (pending?.profile_image_key) await getFiles().delete(pending.profile_image_key);
      await db.prepare("DELETE FROM access_requests WHERE user_id=? AND status='pending'").bind(targetId).run();
      await recordActivity(`${actor.display_name || user.email} rejected ${pending?.display_name ? `${pending.display_name}’s request` : 'the access request'}`, now);
    } else if (body.action === 'remove_member') {
      if (actor.role !== 'host') throw new Error('Only the host can remove members.');
      if (!targetId) throw new Error('User is required.');
      const target = await db.prepare('SELECT role,display_name,profile_image_key FROM members WHERE user_id=?').bind(targetId).first<{role: Role; display_name: string | null; profile_image_key: string | null}>();
      if (!target || target.role === 'host' || targetId === user.userId) throw new Error('This member cannot be removed.');
      if (target.profile_image_key) await getFiles().delete(target.profile_image_key);
      await db.batch([
        db.prepare("UPDATE members SET status='removed',display_name=NULL,profile_image_key=NULL,last_seen_at=NULL,updated_at=? WHERE user_id=?").bind(now, targetId),
        db.prepare('DELETE FROM presence_sessions WHERE user_id=?').bind(targetId),
      ]);
      await recordActivity(`${target.display_name || 'Member'} went offline — access removed by ${actor.display_name || user.email}`, now);
    } else if (body.action === 'set_board_title') {
      const title = body.title?.trim(); if (!title || title.length > 64) throw new Error('Board title must be 1–64 characters.');
      await db.prepare(`INSERT INTO board_state (key,value,updated_at,updated_by) VALUES ('title',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(title, now, user.userId).run();
      await recordActivity(`${actor.display_name || user.email} changed the board title`, now);
    } else if (body.action === 'clear_test_data') {
      if (actor.role !== 'host') throw new Error('Only the host can clear test data.');
      const objects = await getFiles().list({ prefix: 'profiles/' });
      const keys = objects.objects.map((item) => item.key);
      const pendingObjects = await getFiles().list({ prefix: 'pending-profiles/' });
      keys.push(...pendingObjects.objects.map((item) => item.key));
      if (keys.length) await getFiles().delete(keys);
      await db.batch([
        db.prepare("DELETE FROM members WHERE role!='host'"),
        db.prepare("UPDATE members SET display_name=NULL,profile_image_key=NULL,acting_state='',note=NULL,note_updated_at=NULL,last_seen_at=NULL,updated_at=? WHERE role='host'").bind(now),
        db.prepare('DELETE FROM access_requests'),
        db.prepare('DELETE FROM presence_sessions'),
        db.prepare('DELETE FROM extension_pairing_codes'),
        db.prepare('DELETE FROM extension_credentials'),
        db.prepare('DELETE FROM extension_sessions'),
        db.prepare('DELETE FROM role_statuses'),
        db.prepare('DELETE FROM board_state'),
        db.prepare('DELETE FROM activity_log'),
      ]);
    } else throw new Error('Unknown action.');
    return Response.json(await getWorkspacePayload(user));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Administration failed.' }, { status: 400 }); }
}
