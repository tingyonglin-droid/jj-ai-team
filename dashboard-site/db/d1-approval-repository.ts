import { and, eq, inArray } from "drizzle-orm";

import {
  approvalEventFromRow,
  type ApprovalEvent,
  type ApprovalEventRepository,
} from "./approval-store";
import { getDb } from "./index";
import { approvalEvents } from "./schema";

export class DrizzleApprovalEventRepository implements ApprovalEventRepository {
  constructor(private readonly db = getDb()) {}

  async list() {
    const rows = await this.db.select().from(approvalEvents);
    return rows.map(approvalEventFromRow);
  }

  async findByArtifact(
    artifactId: string,
    artifactVersion: number,
    action: ApprovalEvent["action"],
  ) {
    const [row] = await this.db
      .select()
      .from(approvalEvents)
      .where(
        and(
          eq(approvalEvents.artifactId, artifactId),
          eq(approvalEvents.artifactVersion, artifactVersion),
          eq(approvalEvents.action, action),
        ),
      )
      .limit(1);
    return row ? approvalEventFromRow(row) : null;
  }

  async insert(event: ApprovalEvent) {
    const rows = await this.db
      .insert(approvalEvents)
      .values(event)
      .onConflictDoNothing()
      .returning({ eventId: approvalEvents.eventId });
    return rows.length === 1;
  }

  async markSynced(eventIds: string[], syncedAt: string) {
    if (eventIds.length === 0) return;
    await this.db
      .update(approvalEvents)
      .set({ syncStatus: "synced", syncedAt })
      .where(inArray(approvalEvents.eventId, eventIds));
  }
}
