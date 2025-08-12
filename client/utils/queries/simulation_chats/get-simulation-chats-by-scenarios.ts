// utils/queries/simulation_chats/get-simulation-chats-by-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatsByScenarios(scenarioIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.scenarioId, scenarioIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chats by scenarios",
      subject: { entityType: "simulation_chats" },
      context: { function: "_getSimulationChatsByScenarios", file: "utils/queries/simulation_chats/get-simulation-chats-by-scenarios.ts", foreignKey: "scenarioId", foreignIdsCount: scenarioIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatsByScenarios = createMockableAction('getSimulationChatsByScenarios', _getSimulationChatsByScenarios);
