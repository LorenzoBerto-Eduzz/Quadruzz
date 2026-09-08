/* oxlint-disable next/no-html-link-for-pages */
import { redirect } from 'next/navigation';

import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function AuthenticationPage() {
  const user = await getChatGPTUser();

  if (user) {
    redirect('/');
  }

  return (
    <main className="gate">
      <a className="plain-action" href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT</a>
    </main>
  );
}