import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Cross-Quadruzz',
  description: 'Privacy policy for the Cross-Quadruzz Chrome extension.',
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <h1>Cross-Quadruzz Privacy Policy</h1>
        <p className="privacy-updated">Effective September 11, 2026</p>

        <h2>Purpose</h2>
        <p>Cross-Quadruzz gives approved team members quick access to their shared member list, activity state, acting state, and notes from the browser.</p>

        <h2>Data used</h2>
        <p>The extension uses the authorized member&apos;s stable ChatGPT account identifier, Cross-Quadruzz profile and membership data, shared acting state and notes, and recent extension activity. A revocable authorization token and local overlay state are stored in the browser.</p>

        <h2>Browser access</h2>
        <p>The extension places its floating interface on ordinary browser tabs. It does not read, collect, store, or transmit page content, browsing history, form entries, passwords, or keystrokes outside its own keyboard shortcut.</p>

        <h2>How data is used</h2>
        <p>Data is used only to authenticate approved members, display and update Cross-Quadruzz workspace information, and indicate whether an authorized extension is active.</p>

        <h2>Sharing and sale</h2>
        <p>Cross-Quadruzz does not sell personal data, use it for advertising, or share it with unrelated third parties. Workspace profile, state, note, and activity information is visible only to authorized Cross-Quadruzz members and is processed by the services operating the application.</p>

        <h2>Retention and control</h2>
        <p>Extension activity expires automatically after the extension stops communicating. Members can sign out or remove the extension to remove its local authorization. Workspace administrators can revoke membership and extension access.</p>

        <h2>Contact</h2>
        <p>For privacy questions or deletion requests, contact the Cross-Quadruzz administrator through your organization.</p>

        <Link className="privacy-back" href="/">Return to Cross-Quadruzz</Link>
      </article>
    </main>
  );
}
