// utils/queries/system_agents/get-all-system-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSystemAgents() {
  try {
    return await db.select().from(systemAgents);
  } catch (error) {
    logError("Error fetching all system_agents:", error);
    throw error;
  }
}
