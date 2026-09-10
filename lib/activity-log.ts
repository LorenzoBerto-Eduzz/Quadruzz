import { getDb } from '@/db';
import type { ActivityEntry } from '@/lib/workspace-types';

const ACTIVITY_LIMIT = 30;
const STALE_PRESENCE_AFTER_MS = 45_000;

export async function recordActivity(message: string, createdAt = Date.now(), dedupeKey: string | null = null): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key) VALUES (?,?,?)').bind(message, createdAt, dedupeKey),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ACTIVITY_LIMIT),
  ]);
}

export async function listActivity(): Promise<ActivityEntry[]> {
  return (await getDb().prepare('SELECT id,message,created_at AS createdAt FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?').bind(ACTIVITY_LIMIT).all<ActivityEntry>()).results;
}

export async function expireStalePresence(now = Date.now()): Promise<void> {
  const cutoff = now - STALE_PRESENCE_AFTER_MS;
  const db = getDb();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT m.display_name || ' went offline — connection timed out', ?, 'presence-timeout:' || p.user_id || ':' || MAX(p.last_seen_at)
      FROM presence_sessions p JOIN members m ON m.user_id=p.user_id
      WHERE m.display_name IS NOT NULL
      GROUP BY p.user_id HAVING MAX(p.last_seen_at) < ?`).bind(now, cutoff),
    db.prepare('DELETE FROM presence_sessions WHERE last_seen_at<?').bind(cutoff),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ACTIVITY_LIMIT),
  ]);
}

export async function markOnline(userId: string, sessionId: string, displayName: string, now: number): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM presence_sessions WHERE user_id=? AND last_seen_at>=?)`)
      .bind(`${displayName} came online — Quadruzz opened`, now, `presence-online:${userId}:${sessionId}`, userId, now - STALE_PRESENCE_AFTER_MS),
    db.prepare('INSERT INTO presence_sessions (session_id,user_id,last_seen_at) VALUES (?,?,?) ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at').bind(sessionId, userId, now),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ACTIVITY_LIMIT),
  ]);
}

export async function markSessionClosed(userId: string, sessionId: string, displayName: string, now: number): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('DELETE FROM presence_sessions WHERE session_id=? AND user_id=?').bind(sessionId, userId),
    db.prepare(`INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM presence_sessions WHERE user_id=? AND last_seen_at>=?)`)
      .bind(`${displayName} went offline — Quadruzz closed`, now, `presence-close:${userId}:${sessionId}`, userId, now - STALE_PRESENCE_AFTER_MS),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ACTIVITY_LIMIT),
  ]);
}

export async function markSignedOut(userId: string, displayName: string, now: number): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('DELETE FROM presence_sessions WHERE user_id=?').bind(userId),
    db.prepare('INSERT OR IGNORE INTO activity_log (message,created_at,dedupe_key) VALUES (?,?,?)').bind(`${displayName} went offline — signed out`, now, `presence-signout:${userId}:${now}`),
    db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ACTIVITY_LIMIT),
  ]);
}
