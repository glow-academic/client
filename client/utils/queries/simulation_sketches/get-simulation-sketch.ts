// utils/queries/simulation_sketches/get-simulation-sketch.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationSketch(id: string) {
  try {
    const result = await db.select().from(simulationSketches).where(eq(simulationSketches.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationSketch:", error);
    throw error;
  }
}
