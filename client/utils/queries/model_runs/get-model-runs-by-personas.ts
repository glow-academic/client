// utils/queries/model_runs/get-model-runs-by-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getModelRunsByPersonas(personaIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.personaId, personaIds));
  } catch (error) {
    logError("Error fetching model_runs by personas:", error);
    throw error;
  }
}
