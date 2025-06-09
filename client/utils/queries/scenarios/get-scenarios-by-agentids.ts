// utils/queries/scenarios/get-scenarios-by-agentids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getScenariosByAgentids(agentidIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.agent_id, agentidIds));
  } catch (error) {
    console.error("Error fetching scenarios by agentids:", error);
    throw error;
  }
}
