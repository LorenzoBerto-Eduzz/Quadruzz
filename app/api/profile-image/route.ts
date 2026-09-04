import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getFiles } from '@/db';
import { requireApproved } from '@/lib/workspace-data';

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
    const member = await requireApproved(user.userId);
    const form = await request.formData(); const file = form.get('image');
    if (!(file instanceof File)) return Response.json({ error: 'Choose an image.' }, { status: 400 });
    if (!ALLOWED.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Use a JPG, PNG, WebP, or GIF up to 5 MB.' }, { status: 400 });
    const extension = file.type.split('/')[1].replace('jpeg','jpg');
    const key = `profiles/${user.userId}/${crypto.randomUUID()}.${extension}`;
    await getFiles().put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    await getDb().prepare('UPDATE members SET profile_image_key=?,updated_at=? WHERE user_id=?').bind(key, Date.now(), user.userId).run();
    if (member.profile_image_key) await getFiles().delete(member.profile_image_key);
    return Response.json({ ok: true, imageUrl: `/api/profile-image?v=${Date.now()}` });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status: 400 }); }
}
