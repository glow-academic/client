// utils/queries/simulation_chats/get-simulation-chats-by-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatsByScenario(scenarioId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.scenarioId, scenarioId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chats by scenario",
      subject: { entityType: "simulation_chats" },
      context: { function: "_getSimulationChatsByScenario", file: "utils/queries/simulation_chats/get-simulation-chats-by-scenario.ts", foreignKey: "scenarioId", foreignId: String(scenarioId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatsByScenario = createMockableAction('getSimulationChatsByScenario', _getSimulationChatsByScenario);
