"use server";
import { simulations } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateSimulation(id: string, title?: string, timeLimit?: number | null, documents?: string[], interactionIds?: string[], active?: boolean) {
  try {
    const updatedSimulation = await db
      .update(simulations)
      .set({
        title,
        timeLimit,
        documents: documents || [],
        interactionIds,
        active,
      })
      .where(eq(simulations.id, id))
      .returning();

    if (updatedSimulation.length === 0) {
      return { success: false, error: "Simulation not found" };
    }

    return { success: true, simulation: updatedSimulation[0], error: "" };
  } catch (error) {
    console.error("Error updating simulation:", error);
    return { success: false, error: "Failed to update simulation" };
  }
} 