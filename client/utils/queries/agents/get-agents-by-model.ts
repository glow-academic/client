// utils/queries/agents/get-agents-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAgentsByModel(modelId: string) {
  try {
    return await db.select().from(agents).where(eq(agents.modelId, modelId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching agents by model",
      subject: { entityType: "agents" },
      context: { function: "_getAgentsByModel", file: "utils/queries/agents/get-agents-by-model.ts", foreignKey: "modelId", foreignId: String(modelId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAgentsByModel = createMockableAction('getAgentsByModel', _getAgentsByModel);
