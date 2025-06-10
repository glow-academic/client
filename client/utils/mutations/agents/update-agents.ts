// utils/mutations/agents/update-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateAgents(ids: string[], data: Partial<typeof agents.$inferInsert>) {
  try {
    return await db.update(agents).set(data).where(inArray(agents.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple agents:", error);
    throw error;
  }
}
