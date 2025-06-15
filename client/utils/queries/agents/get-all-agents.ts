// utils/queries/agents/get-all-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAgents() {
  try {
    return await db.select().from(agents);
  } catch (error) {
    logError("Error fetching all agents:", error);
    throw error;
  }
}
