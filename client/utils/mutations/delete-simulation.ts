"use server";
import { simulations } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteSimulation(id: string) {
  try {
    const deletedSimulation = await db
      .delete(simulations)
      .where(eq(simulations.id, id))
      .returning();

    if (deletedSimulation.length === 0) {
      return { success: false, error: "Simulation not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting simulation:", error);
    return { success: false, error: "Failed to delete simulation" };
  }
} 