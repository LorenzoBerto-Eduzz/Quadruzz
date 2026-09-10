'use client';
import { useState } from 'react';

export function ExtensionConnect() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  async function createCode() {
    setError('');
    const response = await fetch('/api/extension', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_pairing_code' }) });
    const data = await response.json() as { code?: string; error?: string };
    if (!response.ok || !data.code) return setError(data.error || 'Could not create a code.');
    setCode(data.code);
  }
  return <main className="extension-connect"><h1>Connect Quadruzz</h1>{code ? <><p>Enter this code in the extension:</p><button className="pairing-code" type="button" onClick={() => void navigator.clipboard.writeText(code)}>{code}</button><small>Valid for 10 minutes. Click to copy.</small></> : <button className="plain-action" type="button" onClick={() => void createCode()}>Create pairing code</button>}{error && <p className="plain-error">{error}</p>}</main>;
}
