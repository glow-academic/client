// utils/queries/model_runs/get-model-runs-by-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getModelRunsByPersona(personaId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.personaId, personaId));
  } catch (error) {
    logError("Error fetching model_runs by persona:", error);
    throw error;
  }
}
