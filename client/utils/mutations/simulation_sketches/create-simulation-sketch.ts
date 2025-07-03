// utils/mutations/simulation_sketches/create-simulation-sketch.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationSketch(data: typeof simulationSketches.$inferInsert) {
  try {
    const result = await db.insert(simulationSketches).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationSketch:", error);
    throw error;
  }
}
