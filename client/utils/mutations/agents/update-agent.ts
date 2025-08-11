// utils/mutations/agents/update-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAgent(id: string, data: Partial<typeof agents.$inferInsert>) {
  try {
    const result = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating agent:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAgent = createMockableAction('updateAgent', _updateAgent);
