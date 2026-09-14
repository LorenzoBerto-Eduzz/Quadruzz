import { getDb } from '@/db';

export const EXTENSION_ACTIVE_AFTER_MS = 30_000;
export const EXTENSION_READER_REFRESH_MS = 10_000;

export async function expireStaleExtensionSessions(now = Date.now()): Promise<void> {
  await getDb().prepare('DELETE FROM extension_sessions WHERE last_seen_at<?').bind(now - EXTENSION_ACTIVE_AFTER_MS).run();
}
