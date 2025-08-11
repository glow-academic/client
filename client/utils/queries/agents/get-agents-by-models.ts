// utils/queries/agents/get-agents-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAgentsByModels(modelIds: string[]) {
  try {
    return await db.select().from(agents).where(inArray(agents.modelId, modelIds));
  } catch (error) {
    logError("Error fetching agents by models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAgentsByModels = createMockableAction('getAgentsByModels', _getAgentsByModels);
