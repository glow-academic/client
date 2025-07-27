// utils/queries/agents/get-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgent(id: string) {
  try {
    const result = await db.select().from(agents).where(eq(agents.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching agent:", error);
    throw error;
  }
}
