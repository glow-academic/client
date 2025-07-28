// utils/queries/simulations/get-simulations-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationsByRubric(rubricId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching simulations by rubric:", error);
    throw error;
  }
}
