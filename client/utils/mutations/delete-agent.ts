"use server";
import { agents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteAgent(id: string) {
  try {
    const deletedAgent = await db
      .delete(agents)
      .where(eq(agents.id, id))
      .returning();

    if (deletedAgent.length === 0) {
      return { success: false, error: "Agent not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting agent:", error);
    return { success: false, error: "Failed to delete agent" };
  }
} 