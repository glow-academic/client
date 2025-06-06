"use server";
import { interactions } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteInteraction(id: string) {
  try {
    const deletedInteraction = await db
      .delete(interactions)
      .where(eq(interactions.id, id))
      .returning();

    if (deletedInteraction.length === 0) {
      return { success: false, error: "Interaction not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting interaction:", error);
    return { success: false, error: "Failed to delete interaction" };
  }
} 