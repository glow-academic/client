// utils/queries/personas/get-personas-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersonasByModels(modelIds: string[]) {
  try {
    return await db.select().from(personas).where(inArray(personas.modelId, modelIds));
  } catch (error) {
    logError("Error fetching personas by models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersonasByModels = createMockableAction('getPersonasByModels', _getPersonasByModels);
