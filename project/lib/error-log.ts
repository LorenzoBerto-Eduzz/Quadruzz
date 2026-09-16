import { getDb } from '@/db';

const ERROR_LIMIT = 100;

function conciseMessage(context: string, cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'Unknown failure';
  const printable = Array.from(detail, (character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 ? ' ' : character; }).join('');
  const clean = printable.replace(/\s+/g, ' ').trim();
  return `${context}: ${clean || 'Unknown failure'}`.slice(0, 220);
}

export async function recordError(context: string, cause: unknown, createdAt = Date.now()): Promise<void> {
  try {
    const db = getDb();
    await db.batch([
      db.prepare('INSERT INTO error_log (message,created_at) VALUES (?,?)').bind(conciseMessage(context, cause), createdAt),
      db.prepare('DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY created_at DESC,id DESC LIMIT ?)').bind(ERROR_LIMIT),
    ]);
  } catch { /* A failing diagnostics store must not create another user-facing failure. */ }
}
