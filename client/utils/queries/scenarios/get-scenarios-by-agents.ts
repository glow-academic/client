// utils/queries/scenarios/get-scenarios-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getScenariosByAgents(agentIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.agent_id, agentIds));
  } catch (error) {
    console.error("Error fetching scenarios by agents:", error);
    throw error;
  }
}
