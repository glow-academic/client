// utils/mutations/agents/update-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAgent(id: string, data: Partial<typeof agents.$inferInsert>) {
  try {
    const result = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating agent:", error);
    throw error;
  }
}
