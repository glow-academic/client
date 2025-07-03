// utils/mutations/simulation_sketches/create-simulation-sketches.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationSketches(data: (typeof simulationSketches.$inferInsert)[]) {
  try {
    return await db.insert(simulationSketches).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_sketches:", error);
    throw error;
  }
}
