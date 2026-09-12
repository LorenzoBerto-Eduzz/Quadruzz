import { getDb } from '@/db';

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createExtensionCredential(userId: string, now = Date.now()): Promise<string> {
  const token = randomToken();
  await getDb().prepare('INSERT INTO extension_credentials (token_hash,user_id,created_at,last_used_at) VALUES (?,?,?,?)').bind(await hash(token), userId, now, now).run();
  return token;
}

export async function authenticateExtensionIdentity(request: Request, now = Date.now()): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const tokenHash = await hash(token);
  const db = getDb();
  const credential = await db.prepare('SELECT user_id,last_used_at FROM extension_credentials WHERE token_hash=? AND revoked_at IS NULL').bind(tokenHash).first<{ user_id: string; last_used_at: number }>();
  if (!credential) return null;
  if (credential.last_used_at < now - 15 * 60_000) {
    await db.prepare('UPDATE extension_credentials SET last_used_at=? WHERE token_hash=?').bind(now, tokenHash).run();
  }
  return credential.user_id;
}

export async function authenticateExtension(request: Request, now = Date.now()): Promise<string | null> {
  const userId = await authenticateExtensionIdentity(request, now);
  if (!userId) return null;
  const member = await getDb().prepare("SELECT 1 FROM members WHERE user_id=? AND status='approved'").bind(userId).first();
  return member ? userId : null;
}