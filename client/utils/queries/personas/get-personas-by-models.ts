// utils/queries/personas/get-personas-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getPersonasByModels(modelIds: string[]) {
  try {
    return await db
      .select()
      .from(personas)
      .where(inArray(personas.modelId, modelIds));
  } catch (error) {
    logError("Error fetching personas by models:", error);
    throw error;
  }
}
