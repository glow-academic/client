// utils/mutations/agents/create-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAgents(data: (typeof agents.$inferInsert)[]) {
  try {
    return await db.insert(agents).values(data).returning();
  } catch (error) {
    logError("Error creating multiple agents:", error);
    throw error;
  }
}
