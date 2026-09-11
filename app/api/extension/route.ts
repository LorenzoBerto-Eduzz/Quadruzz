import { getDb } from '@/db';
import { authenticateExtension } from '@/lib/extension-auth';
import { expireStalePresence, STALE_PRESENCE_AFTER_MS } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'cache-control': 'no-store, max-age=0' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  try {
    const userId = await authenticateExtension(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const now = Date.now();
    await expireStalePresence(now);
    const members = (await getDb().prepare(`SELECT m.user_id AS userId,m.display_name AS displayName,m.updated_at AS imageVersion,m.acting_state AS actingState,m.note,EXISTS(SELECT 1 FROM presence_sessions p WHERE p.user_id=m.user_id AND p.last_seen_at>=?) AS online FROM members m WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL ORDER BY m.join_order ASC`).bind(now - STALE_PRESENCE_AFTER_MS).all()).results;
    return reply({ currentUserId: userId, members });
  } catch { return reply({ error: 'Quadruzz is temporarily unavailable.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateExtension(request);
    if (!userId) return reply({ error: 'Extension authorization required.' }, 401);
    const body = await request.json() as { actingState?: string; note?: string | null };
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
