// utils/queries/personas/get-personas-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersonasByModel(modelId: string) {
  try {
    return await db.select().from(personas).where(eq(personas.modelId, modelId));
  } catch (error) {
    logError("Error fetching personas by model:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersonasByModel = createMockableAction('getPersonasByModel', _getPersonasByModel);
