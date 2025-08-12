// utils/mutations/agents/delete-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAgents(ids: string[]) {
  try {
    return await db.delete(agents).where(inArray(agents.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple agents",
      subject: { entityType: "agents" },
      context: { function: "_deleteAgents", file: "utils/mutations/agents/delete-agents.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAgents = createMockableAction('deleteAgents', _deleteAgents);
