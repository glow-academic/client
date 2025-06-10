// utils/queries/simulation_attempts/get-simulation-attempts-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationAttemptsByClass(classIds: string[]) {
  try {
    return await db
      .select()
      .from(simulationAttempts)
      .where(inArray(simulationAttempts.classId, classIds));
  } catch (error) {
    console.error("Error fetching simulation_attempts by class:", error);
    throw error;
  }
}
