// utils/queries/personas/get-personas-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getPersonasByModel(modelId: string) {
  try {
    return await db
      .select()
      .from(personas)
      .where(eq(personas.modelId, modelId));
  } catch (error) {
    logError("Error fetching personas by model:", error);
    throw error;
  }
}
