import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getFiles } from '@/db';
import { requireApproved } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';
const EXTENSION_KEY = 'extension/cross-quadruzz-extension-0.1.0.zip';
const FALLBACK_PATH = '/downloads/cross-quadruzz-extension-0.1.0.zip';
const MAX_EXTENSION_BYTES = 10 * 1024 * 1024;

function downloadHeaders(): Headers {
  return new Headers({
    'cache-control': 'private, no-store',
    'content-disposition': 'attachment; filename="cross-quadruzz-extension-0.1.0.zip"',
    'content-type': 'application/zip',
  });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response('Authentication required.', { status: 401 });
  try { await requireApproved(user.userId); }
  catch { return new Response('Forbidden.', { status: 403 }); }
  const object = await getFiles().get(EXTENSION_KEY);
  if (!object) return Response.redirect(new URL(FALLBACK_PATH, request.url), 302);
  return new Response(object.body, { headers: downloadHeaders() });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const member = await requireApproved(user.userId);
    if (member.role !== 'host') return Response.json({ error: 'Only the host can upload the extension.' }, { status: 403 });
    const candidate = (await request.formData()).get('extension');
    if (!(candidate instanceof File) || !candidate.size || candidate.size > MAX_EXTENSION_BYTES || !candidate.name.toLowerCase().endsWith('.zip')) {
      return Response.json({ error: 'Choose a ZIP file up to 10 MB.' }, { status: 400 });
    }
    const bytes = await candidate.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b) return Response.json({ error: 'The selected file is not a valid ZIP.' }, { status: 400 });
    await getFiles().put(EXTENSION_KEY, bytes, { httpMetadata: { contentType: 'application/zip', contentDisposition: 'attachment; filename="cross-quadruzz-extension-0.1.0.zip"' } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: 'Extension upload failed.' }, { status: 400 }); }
}
