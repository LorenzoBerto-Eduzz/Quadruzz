import { redirect } from 'next/navigation';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { WorkspaceApp } from '@/components/workspace/workspace-app';
import { getWorkspacePayload } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    redirect('/authentication');
  }

  const workspace = await getWorkspacePayload(user);
  const initialData = workspace.accessState === 'approved'
    ? { ...workspace, members: workspace.members.map((member) => member.userId === user.userId ? { ...member, online: true } : member) }
    : workspace;

  return <WorkspaceApp initialData={initialData} />;
}