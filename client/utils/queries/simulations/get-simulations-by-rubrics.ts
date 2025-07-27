// utils/queries/simulations/get-simulations-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationsByRubrics(rubricIds: string[]) {
  try {
    return await db
      .select()
      .from(simulations)
      .where(inArray(simulations.rubricId, rubricIds));
  } catch (error) {
    logError("Error fetching simulations by rubrics:", error);
    throw error;
  }
}
