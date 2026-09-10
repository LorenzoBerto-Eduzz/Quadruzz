import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { authenticateExtension, createPairingCode, exchangePairingCode } from '@/lib/extension-auth';
import { expireStalePresence, STALE_PRESENCE_AFTER_MS } from '@/lib/activity-log';
import { requireApproved } from '@/lib/workspace-data';

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
    const members = (await getDb().prepare(`SELECT m.user_id AS userId,m.display_name AS displayName,m.updated_at AS imageVersion,EXISTS(SELECT 1 FROM presence_sessions p WHERE p.user_id=m.user_id AND p.last_seen_at>=?) AS online FROM members m WHERE m.status='approved' AND m.display_name IS NOT NULL AND m.profile_image_key IS NOT NULL ORDER BY m.join_order ASC`).bind(now - STALE_PRESENCE_AFTER_MS).all()).results;
    return reply({ currentUserId: userId, members });
  } catch { return reply({ error: 'Quadruzz is temporarily unavailable.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; code?: string };
    if (body.action === 'create_pairing_code') {
      const user = await getChatGPTUser();
      if (!user) return reply({ error: 'Sign in with ChatGPT first.' }, 401);
      await requireApproved(user.userId);
      return reply(await createPairingCode(user.userId));
    }
    if (body.action === 'exchange_pairing_code') {
      const token = body.code ? await exchangePairingCode(body.code) : null;
      return token ? reply({ token }) : reply({ error: 'That pairing code is invalid or expired.' }, 400);
    }
    return reply({ error: 'Unknown action.' }, 400);
  } catch { return reply({ error: 'Request failed.' }, 400); }
}
