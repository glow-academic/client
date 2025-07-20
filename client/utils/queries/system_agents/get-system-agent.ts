// utils/queries/system_agents/get-system-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSystemAgent(id: string) {
  try {
    const result = await db.select().from(systemAgents).where(eq(systemAgents.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching systemAgent:", error);
    throw error;
  }
}
