// utils/mutations/simulations/delete-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulation(id: string) {
  try {
    const result = await db
      .delete(simulations)
      .where(eq(simulations.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulation:", error);
    throw error;
  }
}
