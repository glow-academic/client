// utils/queries/scenarios/get-scenarios-by-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getScenariosByAgent(agentId: string) {
  try {
    return await db.select().from(scenarios).where(eq(scenarios.agent_id, agentId));
  } catch (error) {
    console.error("Error fetching scenarios by agent:", error);
    throw error;
  }
}
