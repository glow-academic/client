// utils/mutations/system_agents/delete-system-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSystemAgents(ids: string[]) {
  try {
    return await db.delete(systemAgents).where(inArray(systemAgents.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple system_agents:", error);
    throw error;
  }
}
