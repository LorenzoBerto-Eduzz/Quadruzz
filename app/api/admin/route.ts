import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { getWorkspacePayload, requireAdmin } from '@/lib/workspace-data';
import type { Role } from '@/lib/workspace-types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const actor = await requireAdmin(user.userId);
    const body = await request.json() as { action?: string; userId?: string; role?: Role; title?: string };
    const db = getDb(); const now = Date.now(); const targetId = body.userId?.trim();
    if (body.action === 'approve') {
      if (!targetId) throw new Error('User is required.');
      const pending = await db.prepare("SELECT email FROM access_requests WHERE user_id=? AND status='pending'").bind(targetId).first<{email: string}>();
      if (!pending) throw new Error('Pending request not found.');
      const next = await db.prepare('SELECT COALESCE(MAX(join_order),0)+1 AS value FROM members').first<{value: number}>();
      await db.batch([
        db.prepare(`INSERT INTO members (user_id,email,role,status,join_order,display_name,profile_image_key,last_seen_at,created_at,updated_at) VALUES (?,?,'member','approved',?,NULL,NULL,NULL,?,?)
          ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,role='member',status='approved',updated_at=excluded.updated_at`).bind(targetId, pending.email, next?.value || 1, now, now),
        db.prepare("UPDATE access_requests SET status='approved',decided_at=?,decided_by=? WHERE user_id=?").bind(now, user.userId, targetId),
      ]);
    } else if (body.action === 'reject') {
      if (!targetId) throw new Error('User is required.');
      await db.prepare("UPDATE access_requests SET status='rejected',decided_at=?,decided_by=? WHERE user_id=? AND status='pending'").bind(now, user.userId, targetId).run();
    } else if (body.action === 'remove_member') {
      if (!targetId) throw new Error('User is required.');
      const target = await db.prepare('SELECT role,profile_image_key FROM members WHERE user_id=?').bind(targetId).first<{role: Role; profile_image_key: string | null}>();
      if (!target || target.role === 'owner' || (target.role === 'admin' && actor.role !== 'owner')) throw new Error('This member cannot be removed by your role.');
      if (target.profile_image_key) await getFiles().delete(target.profile_image_key);
      await db.prepare("UPDATE members SET status='removed',display_name=NULL,profile_image_key=NULL,last_seen_at=NULL,updated_at=? WHERE user_id=?").bind(now, targetId).run();
    } else if (body.action === 'set_role') {
      if (actor.role !== 'owner') throw new Error('Only the owner can manage admin roles.');
      if (!targetId || (body.role !== 'admin' && body.role !== 'member')) throw new Error('Invalid role change.');
      await db.prepare("UPDATE members SET role=?,updated_at=? WHERE user_id=? AND role!='owner' AND status='approved'").bind(body.role, now, targetId).run();
    } else if (body.action === 'set_board_title') {
      const title = body.title?.trim(); if (!title || title.length > 64) throw new Error('Board title must be 1–64 characters.');
      await db.prepare(`INSERT INTO board_state (key,value,updated_at,updated_by) VALUES ('title',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(title, now, user.userId).run();
    } else if (body.action === 'clear_test_data') {
      if (actor.role !== 'owner') throw new Error('Only the owner can clear test data.');
      const objects = await getFiles().list({ prefix: 'profiles/' });
      const ownerPrefix = `profiles/${user.userId}/`;
      const keys = objects.objects.map((item) => item.key).filter((key) => !key.startsWith(ownerPrefix));
      if (keys.length) await getFiles().delete(keys);
      await db.batch([
        db.prepare("DELETE FROM members WHERE role!='owner'"),
        db.prepare('DELETE FROM access_requests'),
        db.prepare('DELETE FROM board_state'),
      ]);
    } else throw new Error('Unknown action.');
    return Response.json(await getWorkspacePayload(user));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Administration failed.' }, { status: 400 }); }
}
