import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { ensureConfiguredHost, getWorkspacePayload, pendingRequestExpiresAt, requireApproved } from '@/lib/workspace-data';
import { recordActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/gif']);

export async function GET(request: Request) {
  const viewer = await getChatGPTUser();
  if (!viewer) return new Response('Authentication required.', { status: 401 });
  try {
    await requireApproved(viewer.userId);
    const target = new URL(request.url).searchParams.get('user') || viewer.userId;
    const row = await getDb().prepare("SELECT profile_image_key FROM members WHERE user_id=? AND status='approved'").bind(target).first<{profile_image_key: string | null}>();
    if (!row?.profile_image_key) return new Response('Not found.', { status: 404 });
    const object = await getFiles().get(row.profile_image_key);
    if (!object) return new Response('Not found.', { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control','private, max-age=300');
    return new Response(object.body, { headers });
  } catch { return new Response('Forbidden.', { status: 403 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    await ensureConfiguredHost(user);
    const form = await request.formData();
    const displayNameValue = form.get('displayName');
    const displayName = typeof displayNameValue === 'string' ? displayNameValue.trim() : '';
    const file = form.get('image');
    if (!displayName || displayName.length > 48) return Response.json({ error: 'Display name must be 1–48 characters.' }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: 'Choose an image.' }, { status: 400 });
    if (!ALLOWED.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Use a JPG, PNG, WebP, or GIF up to 5 MB.' }, { status: 400 });

    const db = getDb();
    const member = await db.prepare("SELECT profile_image_key FROM members WHERE user_id=? AND status='approved'").bind(user.userId).first<{profile_image_key: string | null}>();
    const previousRequest = member ? null : await db.prepare('SELECT profile_image_key FROM access_requests WHERE user_id=?').bind(user.userId).first<{profile_image_key: string | null}>();
    const extension = file.type.split('/')[1].replace('jpeg','jpg');
    const key = `${member ? 'profiles' : 'pending-profiles'}/${user.userId}/${crypto.randomUUID()}.${extension}`;
    const files = getFiles();
    await files.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    try {
      const now = Date.now();
      if (member) {
        await db.prepare('UPDATE members SET display_name=?,profile_image_key=?,last_seen_at=?,updated_at=? WHERE user_id=?').bind(displayName, key, now, now, user.userId).run();
        await recordActivity(member.profile_image_key ? `${displayName} updated their profile` : `${displayName} completed their profile`, now);
      } else {
        await db.prepare(`INSERT INTO access_requests (user_id,email,status,requested_at,decided_at,decided_by,display_name,profile_image_key,expires_at)
          VALUES (?,?,'pending',?,NULL,NULL,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,status='pending',requested_at=excluded.requested_at,decided_at=NULL,decided_by=NULL,display_name=excluded.display_name,profile_image_key=excluded.profile_image_key,expires_at=excluded.expires_at`)
          .bind(user.userId, user.email, now, displayName, key, pendingRequestExpiresAt(now)).run();
        await recordActivity(`${displayName} requested access`, now);
      }
    } catch (error) {
      await files.delete(key);
      throw error;
    }
    const previousKey = member?.profile_image_key || previousRequest?.profile_image_key;
    if (previousKey && previousKey !== key) {
      try { await files.delete(previousKey); } catch { /* The new image is already authoritative. */ }
    }
    return Response.json(await getWorkspacePayload(user));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Profile setup failed.' }, { status: 400 }); }
}
