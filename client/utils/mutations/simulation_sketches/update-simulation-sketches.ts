// utils/mutations/simulation_sketches/update-simulation-sketches.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationSketches(ids: string[], data: Partial<typeof simulationSketches.$inferInsert>) {
  try {
    return await db.update(simulationSketches).set(data).where(inArray(simulationSketches.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_sketches:", error);
    throw error;
  }
}
