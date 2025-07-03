// utils/mutations/simulation_sketches/delete-simulation-sketches.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationSketches(ids: string[]) {
  try {
    return await db.delete(simulationSketches).where(inArray(simulationSketches.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_sketches:", error);
    throw error;
  }
}
