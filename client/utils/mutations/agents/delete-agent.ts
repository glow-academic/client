// utils/mutations/agents/delete-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteAgent(id: string) {
  try {
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting agent:", error);
    throw error;
  }
}
