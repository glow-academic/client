// utils/queries/scenarios/get-scenarios-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByAgents(agentIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.agentId, agentIds));
  } catch (error) {
    logError("Error fetching scenarios by agents:", error);
    throw error;
  }
}
