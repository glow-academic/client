// utils/mutations/system_agents/create-system-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSystemAgent(data: typeof systemAgents.$inferInsert) {
  try {
    const result = await db.insert(systemAgents).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating systemAgent:", error);
    throw error;
  }
}
