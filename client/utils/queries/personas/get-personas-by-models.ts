// utils/queries/personas/get-personas-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersonasByModels(modelIds: string[]) {
  try {
    return await db.select().from(personas).where(inArray(personas.modelId, modelIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching personas by models",
      subject: { entityType: "personas" },
      context: { function: "_getPersonasByModels", file: "utils/queries/personas/get-personas-by-models.ts", foreignKey: "modelId", foreignIdsCount: modelIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersonasByModels = createMockableAction('getPersonasByModels', _getPersonasByModels);
