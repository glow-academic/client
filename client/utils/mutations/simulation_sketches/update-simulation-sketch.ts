// utils/mutations/simulation_sketches/update-simulation-sketch.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationSketch(id: string, data: Partial<typeof simulationSketches.$inferInsert>) {
  try {
    const result = await db.update(simulationSketches).set(data).where(eq(simulationSketches.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationSketch:", error);
    throw error;
  }
}
