// utils/mutations/system_agents/create-system-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSystemAgents(data: (typeof systemAgents.$inferInsert)[]) {
  try {
    return await db.insert(systemAgents).values(data).returning();
  } catch (error) {
    logError("Error creating multiple system_agents:", error);
    throw error;
  }
}
