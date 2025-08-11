// utils/mutations/agents/create-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAgents(data: (typeof agents.$inferInsert)[]) {
  try {
    return await db.insert(agents).values(data).returning();
  } catch (error) {
    logError("Error creating multiple agents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAgents = createMockableAction('createAgents', _createAgents);
