// utils/mutations/simulations/delete-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulation(id: string) {
  try {
    const result = await db
      .delete(simulations)
      .where(eq(simulations.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulation:", error);
    throw error;
  }
}
