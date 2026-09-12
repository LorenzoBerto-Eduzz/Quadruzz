/* oxlint-disable next/no-html-link-for-pages */
import { redirect } from 'next/navigation';

import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function AuthenticationPage({ searchParams }: { searchParams: Promise<{ choose?: string; return_to?: string }> }) {
  const params = await searchParams;
  const user = await getChatGPTUser();

  if (user) {
    redirect('/');
  }

  if (params.choose === '1') {
    redirect(chatGPTSignInPath(params.return_to || '/'));
  }

  return (
    <main className="gate">
      <section className="signed-out-entry">
        <h1>Cross</h1>
        <a className="plain-action" href={chatGPTSignInPath(params.return_to || '/')} target="_top">Sign in with ChatGPT</a>
      </section>
    </main>
  );
}
