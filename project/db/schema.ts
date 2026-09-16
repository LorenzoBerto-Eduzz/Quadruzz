import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  role: text('role', { enum: ['host', 'member'] }).notNull(),
  status: text('status', { enum: ['approved', 'removed'] }).notNull(),
  joinOrder: integer('join_order').notNull().unique(),
  displayName: text('display_name'),
  profileImageKey: text('profile_image_key'),
  actingState: text('acting_state').notNull().default(''),
  note: text('note'),
  noteUpdatedAt: integer('note_updated_at'),
  lastSeenAt: integer('last_seen_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const accessRequests = sqliteTable('access_requests', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull(),
  requestedAt: integer('requested_at').notNull(),
  decidedAt: integer('decided_at'),
  decidedBy: text('decided_by'),
  displayName: text('display_name'),
  profileImageKey: text('profile_image_key'),
  expiresAt: integer('expires_at'),
});

export const boardState = sqliteTable('board_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});
export const presenceSessions = sqliteTable('presence_sessions', {
  sessionId: text('session_id').primaryKey(),
  userId: text('user_id').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
}, (table) => [index('presence_sessions_user_seen_idx').on(table.userId, table.lastSeenAt)]);

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  message: text('message').notNull(),
  createdAt: integer('created_at').notNull(),
  dedupeKey: text('dedupe_key').unique(),
}, (table) => [index('activity_log_created_idx').on(table.createdAt)]);

export const extensionPairingCodes = sqliteTable('extension_pairing_codes', {
  codeHash: text('code_hash').primaryKey(), userId: text('user_id').notNull(), createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(), usedAt: integer('used_at'),
}, (table) => [index('extension_pairing_codes_user_idx').on(table.userId)]);

export const extensionCredentials = sqliteTable('extension_credentials', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull(), createdAt: integer('created_at').notNull(), lastUsedAt: integer('last_used_at').notNull(), revokedAt: integer('revoked_at'),
}, (table) => [index('extension_credentials_user_idx').on(table.userId)]);

export const extensionSessions = sqliteTable('extension_sessions', {
  sessionId: text('session_id').primaryKey(), userId: text('user_id').notNull(), lastSeenAt: integer('last_seen_at').notNull(),
}, (table) => [index('extension_sessions_user_seen_idx').on(table.userId, table.lastSeenAt)]);
export const roleStatuses = sqliteTable('role_statuses', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const noteLog = sqliteTable('note_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  note: text('note').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('note_log_created_idx').on(table.createdAt)]);

export const roleLog = sqliteTable('role_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  oldRole: text('old_role').notNull(),
  newRole: text('new_role').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('role_log_created_idx').on(table.createdAt)]);
