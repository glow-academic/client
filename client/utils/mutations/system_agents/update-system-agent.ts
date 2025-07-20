// utils/mutations/system_agents/update-system-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSystemAgent(id: string, data: Partial<typeof systemAgents.$inferInsert>) {
  try {
    const result = await db.update(systemAgents).set(data).where(eq(systemAgents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating systemAgent:", error);
    throw error;
  }
}
