/* oxlint-disable next/no-html-link-for-pages */
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <main className="gate">
      {user ? (
        <a className="plain-action" href="/workspace">Continue</a>
      ) : (
        <a className="plain-action" href={chatGPTSignInPath('/workspace')} target="_top">Sign in with ChatGPT</a>
      )}
    </main>
  );
}
