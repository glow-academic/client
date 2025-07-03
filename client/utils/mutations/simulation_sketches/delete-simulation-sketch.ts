// utils/mutations/simulation_sketches/delete-simulation-sketch.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationSketch(id: string) {
  try {
    const result = await db.delete(simulationSketches).where(eq(simulationSketches.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationSketch:", error);
    throw error;
  }
}
