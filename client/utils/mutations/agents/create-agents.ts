// utils/mutations/agents/create-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";

export async function createAgents(data: (typeof agents.$inferInsert)[]) {
  try {
    return await db.insert(agents).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple agents:", error);
    throw error;
  }
}
