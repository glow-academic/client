// utils/mutations/agents/delete-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAgent(id: string) {
  try {
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting agent",
      subject: { entityType: "agents", entityId: String(id) },
      context: { function: "_deleteAgent", file: "utils/mutations/agents/delete-agent.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAgent = createMockableAction('deleteAgent', _deleteAgent);
