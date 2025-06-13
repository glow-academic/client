// utils/mutations/agents/delete-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAgent(id: string) {
  try {
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting agent:", error);
    throw error;
  }
}
