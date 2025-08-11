// utils/mutations/agents/delete-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAgents(ids: string[]) {
  try {
    return await db.delete(agents).where(inArray(agents.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple agents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAgents = createMockableAction('deleteAgents', _deleteAgents);
