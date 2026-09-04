import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { WorkspaceApp } from '@/components/workspace/workspace-app';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  await requireChatGPTUser('/workspace');
  return <WorkspaceApp />;
}
