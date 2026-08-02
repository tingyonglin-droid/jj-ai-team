import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const approvalEvents = sqliteTable(
  "approval_events",
  {
    eventId: text("event_id").primaryKey(),
    artifactId: text("artifact_id").notNull(),
    artifactType: text("artifact_type").notNull(),
    artifactVersion: integer("artifact_version").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    syncStatus: text("sync_status").notNull().default("pending"),
    syncedAt: text("synced_at"),
  },
  (table) => [
    uniqueIndex("approval_artifact_action_idx").on(
      table.artifactId,
      table.artifactVersion,
      table.action,
    ),
  ],
);
