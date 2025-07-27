// utils/mutations/agents/create-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAgent(data: typeof agents.$inferInsert) {
  try {
    const result = await db.insert(agents).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating agent:", error);
    throw error;
  }
}
