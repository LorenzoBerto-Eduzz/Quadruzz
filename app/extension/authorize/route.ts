import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { createExtensionCredential } from '@/lib/extension-auth';
import { requireApproved } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

function validRedirect(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-p]{32}\.chromiumapp\.org$/.test(url.hostname) && url.pathname === '/quadruzz' ? url : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectUrl = validRedirect(requestUrl.searchParams.get('redirect_uri'));
  if (!redirectUrl) return new Response('Invalid extension callback.', { status: 400 });
  const user = await getChatGPTUser();
  if (!user) {
    const returnTo = `${requestUrl.pathname}${requestUrl.search}`;
    return Response.redirect(new URL(chatGPTSignInPath(returnTo), requestUrl.origin));
  }
  try { await requireApproved(user.userId); }
  catch { return new Response('Your Quadruzz access is not approved.', { status: 403 }); }
  redirectUrl.hash = new URLSearchParams({ token: await createExtensionCredential(user.userId) }).toString();
  return Response.redirect(redirectUrl);
}
