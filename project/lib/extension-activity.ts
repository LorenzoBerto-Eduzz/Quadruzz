import { getDb } from '@/db';

export const EXTENSION_ACTIVE_AFTER_MS = 90_000;

export async function expireStaleExtensionSessions(now = Date.now()): Promise<void> {
  const cutoff = now - EXTENSION_ACTIVE_AFTER_MS;
  const db = getDb();
  const stale = await db.prepare('SELECT 1 FROM extension_sessions WHERE last_seen_at<? LIMIT 1').bind(cutoff).first();
  if (!stale) return;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT m.display_name || ' went offline — extension stopped responding', ?, 'extension-offline:' || e.user_id || ':' || MAX(e.last_seen_at)
      FROM extension_sessions e JOIN members m ON m.user_id=e.user_id
      WHERE m.display_name IS NOT NULL
      GROUP BY e.user_id HAVING MAX(e.last_seen_at) < ?`).bind(now, cutoff),
    db.prepare('DELETE FROM extension_sessions WHERE last_seen_at<?').bind(cutoff),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT 30)'),
  ]);
}

export async function touchExtensionSession(userId: string, sessionId: string, displayName: string, now = Date.now()): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM extension_sessions WHERE user_id=? AND last_seen_at>=?)`)
      .bind(`${displayName} came online — extension active`, now, `extension-online:${userId}:${sessionId}:${now}`, userId, now - EXTENSION_ACTIVE_AFTER_MS),
    db.prepare('INSERT INTO extension_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET last_seen_at=excluded.last_seen_at WHERE extension_sessions.user_id=excluded.user_id').bind(sessionId, userId, now),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT 30)'),
  ]);
}

export async function closeExtensionSession(userId: string, sessionId: string, displayName: string, now = Date.now()): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('DELETE FROM extension_sessions WHERE session_id=? AND user_id=?').bind(sessionId, userId),
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM extension_sessions WHERE user_id=? AND last_seen_at>=?)`)
      .bind(`${displayName} went offline — extension disconnected`, now, `extension-disconnect:${userId}:${sessionId}`, userId, now - EXTENSION_ACTIVE_AFTER_MS),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT 30)'),
  ]);
}
