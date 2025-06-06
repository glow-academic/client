"use server";
import { simulations } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createSimulation(title: string, timeLimit: number | null, documents: string[], interactionIds: string[]) {
  try {
    const newSimulation = await db
      .insert(simulations)
      .values({
        title,
        timeLimit,
        documents: documents || [],
        interactionIds,
        active: true,
      })
      .returning();

    return { success: true, simulation: newSimulation[0], error: "" };
  } catch (error) {
    console.error("Error creating simulation:", error);
    return { success: false, error: "Failed to create simulation" };
  }
} 