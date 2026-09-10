import { getDb } from '@/db';

const PAIRING_CODE_TTL_MS = 10 * 60_000;
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomText(length: number, alphabet: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPairingCode(userId: string, now = Date.now()): Promise<{ code: string; expiresAt: number }> {
  const code = randomText(8, CODE_ALPHABET);
  const expiresAt = now + PAIRING_CODE_TTL_MS;
  const db = getDb();
  await db.batch([
    db.prepare('DELETE FROM extension_pairing_codes WHERE user_id=? OR expires_at<?').bind(userId, now),
    db.prepare('INSERT INTO extension_pairing_codes (code_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(await hash(code), userId, now, expiresAt),
  ]);
  return { code, expiresAt };
}

export async function exchangePairingCode(code: string, now = Date.now()): Promise<string | null> {
  const db = getDb();
  const codeHash = await hash(code.trim().toUpperCase());
  const pairing = await db.prepare('SELECT user_id FROM extension_pairing_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(codeHash, now).first<{ user_id: string }>();
  if (!pairing) return null;
  const consumed = await db.prepare('UPDATE extension_pairing_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL').bind(now, codeHash).run();
  if (!consumed.meta.changes) return null;
  const token = randomToken();
  await db.prepare('INSERT INTO extension_credentials (token_hash,user_id,created_at,last_used_at) VALUES (?,?,?,?)').bind(await hash(token), pairing.user_id, now, now).run();
  return token;
}

export async function authenticateExtension(request: Request, now = Date.now()): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const tokenHash = await hash(token);
  const db = getDb();
  const credential = await db.prepare(`SELECT c.user_id,c.last_used_at FROM extension_credentials c JOIN members m ON m.user_id=c.user_id WHERE c.token_hash=? AND c.revoked_at IS NULL AND m.status='approved'`).bind(tokenHash).first<{ user_id: string; last_used_at: number }>();
  if (!credential) return null;
  if (credential.last_used_at < now - 15 * 60_000) {
    await db.prepare('UPDATE extension_credentials SET last_used_at=? WHERE token_hash=?').bind(now, tokenHash).run();
  }
  return credential.user_id;
}
