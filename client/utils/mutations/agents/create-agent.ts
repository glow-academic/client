// utils/mutations/agents/create-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAgent(data: typeof agents.$inferInsert) {
  try {
    const result = await db.insert(agents).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating agent:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAgent = createMockableAction('createAgent', _createAgent);
