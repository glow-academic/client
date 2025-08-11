// utils/queries/agents/get-all-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAgents() {
  try {
    return await db.select().from(agents);
  } catch (error) {
    logError("Error fetching all agents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAgents = createMockableAction('getAllAgents', _getAllAgents);
