/* oxlint-disable next/no-html-link-for-pages */
import { ArrowRight, Orbit } from 'lucide-react';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <main className="entrance-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="entrance-card" aria-labelledby="site-title">
        <div className="brand-mark" aria-hidden="true"><Orbit size={26} strokeWidth={1.6} /></div>
        <p className="eyebrow">Private team space</p>
        <h1 id="site-title">Cross-Quadruzz</h1>
        <p className="entrance-copy">
          {user
            ? 'Your ChatGPT identity is confirmed. Continue to request access to the workspace.'
            : 'Sign in with ChatGPT to request access to the workspace.'}
        </p>
        {user ? (
          <a className="primary-action" href="/workspace">
            Continue <ArrowRight size={18} aria-hidden="true" />
          </a>
        ) : (
          // SIWC must use a plain top-level browser navigation.
          <a className="primary-action" href={chatGPTSignInPath('/workspace')} target="_top">
            Sign in with ChatGPT <ArrowRight size={18} aria-hidden="true" />
          </a>
        )}
        <p className="privacy-note">Workspace details stay private until access is approved.</p>
      </section>
    </main>
  );
}

