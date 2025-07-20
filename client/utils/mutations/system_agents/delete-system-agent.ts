// utils/mutations/system_agents/delete-system-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSystemAgent(id: string) {
  try {
    const result = await db.delete(systemAgents).where(eq(systemAgents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting systemAgent:", error);
    throw error;
  }
}
