import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { requireApproved } from '@/lib/workspace-data';
import { ExtensionConnect } from '@/components/extension-connect';

export default async function ExtensionConnectPage() {
  const user = await requireChatGPTUser('/extension/connect');
  await requireApproved(user.userId);
  return <ExtensionConnect />;
}
