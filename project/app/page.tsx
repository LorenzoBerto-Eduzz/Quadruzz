import { redirect } from 'next/navigation';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { WorkspaceApp } from '@/components/workspace/workspace-app';
import { getWorkspacePayload } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ extension_redirect_uri?: string | string[] }> }) {
  const params = await searchParams;
  const redirectUri = typeof params.extension_redirect_uri === 'string' ? params.extension_redirect_uri : null;
  const extensionAuthorizeUrl = redirectUri ? `/extension/authorize?redirect_uri=${encodeURIComponent(redirectUri)}` : null;
  const user = await getChatGPTUser();

  if (!user) {
    const returnTo = redirectUri ? `/?extension_redirect_uri=${encodeURIComponent(redirectUri)}` : '/';
    redirect(`/authentication?return_to=${encodeURIComponent(returnTo)}`);
  }

  return <WorkspaceApp initialData={await getWorkspacePayload(user)} extensionAuthorizeUrl={extensionAuthorizeUrl} />;
}
