import { env } from 'cloudflare:workers';

export function getDb(): D1Database {
  if (!env.DB) throw new Error('Sites D1 binding `DB` is unavailable.');
  return env.DB;
}

export function getFiles(): R2Bucket {
  if (!env.FILES) throw new Error('Sites R2 binding `FILES` is unavailable.');
  return env.FILES;
}

export function configuredOwnerUserId(): string | null {
  return env.QUADRUZZ_OWNER_USER_ID?.trim() || null;
}
