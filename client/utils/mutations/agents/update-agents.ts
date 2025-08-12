// utils/mutations/agents/update-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAgents(ids: string[], data: Partial<typeof agents.$inferInsert>) {
  try {
    return await db.update(agents).set(data).where(inArray(agents.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple agents",
      subject: { entityType: "agents" },
      context: { function: "_updateAgents", file: "utils/mutations/agents/update-agents.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAgents = createMockableAction('updateAgents', _updateAgents);
