// utils/mutations/agents/delete-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAgents(ids: string[]) {
  try {
    return await db.delete(agents).where(inArray(agents.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple agents:", error);
    throw error;
  }
}
