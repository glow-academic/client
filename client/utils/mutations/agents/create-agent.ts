// utils/mutations/agents/create-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";

export async function createAgent(data: typeof agents.$inferInsert) {
  try {
    const result = await db.insert(agents).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating agent:", error);
    throw error;
  }
}
