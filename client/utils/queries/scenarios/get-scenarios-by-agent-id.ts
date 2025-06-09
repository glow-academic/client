// utils/queries/scenarios/get-scenarios-by-agentid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getScenariosByAgentid(agentidId: string) {
  try {
    return await db.select().from(scenarios).where(eq(scenarios.agent_id, agentidId));
  } catch (error) {
    console.error("Error fetching scenarios by agentid:", error);
    throw error;
  }
}
