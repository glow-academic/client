// utils/mutations/system_agents/update-system-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSystemAgents(ids: string[], data: Partial<typeof systemAgents.$inferInsert>) {
  try {
    return await db.update(systemAgents).set(data).where(inArray(systemAgents.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple system_agents:", error);
    throw error;
  }
}
