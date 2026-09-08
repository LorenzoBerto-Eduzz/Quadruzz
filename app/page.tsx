import { redirect } from 'next/navigation';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { WorkspaceApp } from '@/components/workspace/workspace-app';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    redirect('/authentication');
  }

  return <WorkspaceApp />;
}