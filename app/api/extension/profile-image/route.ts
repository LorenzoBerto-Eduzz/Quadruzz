import { getDb, getFiles } from '@/db';
import { authenticateExtension } from '@/lib/extension-auth';

export const dynamic = 'force-dynamic';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET, OPTIONS' };
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(request: Request) {
  const viewerId = await authenticateExtension(request);
  if (!viewerId) return Response.json({ error: 'Extension authorization required.' }, { status: 401, headers: cors });
  const userId = new URL(request.url).searchParams.get('user');
  if (!userId) return Response.json({ error: 'Missing member.' }, { status: 400, headers: cors });
  const member = await getDb().prepare("SELECT profile_image_key,updated_at FROM members WHERE user_id=? AND status='approved'").bind(userId).first<{ profile_image_key: string | null; updated_at: number }>();
  if (!member?.profile_image_key) return new Response(null, { status: 404, headers: cors });
  const object = await getFiles().get(member.profile_image_key);
  if (!object) return new Response(null, { status: 404, headers: cors });
  const headers = new Headers(cors);
  headers.set('content-type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('etag', `"${member.updated_at}"`);
  return new Response(object.body, { headers });
}
