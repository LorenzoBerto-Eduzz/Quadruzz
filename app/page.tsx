/* oxlint-disable next/no-html-link-for-pages */
import { redirect } from 'next/navigation';

import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();

  if (user) {
    redirect('/workspace');
  }

  return (
    <main className="gate">
      <a className="plain-action" href={chatGPTSignInPath('/workspace')} target="_top">Sign in with ChatGPT</a>
    </main>
  );
}
