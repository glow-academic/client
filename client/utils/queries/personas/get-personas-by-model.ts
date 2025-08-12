// utils/queries/personas/get-personas-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getPersonasByModel(modelId: string) {
  try {
    return await db.select().from(personas).where(eq(personas.modelId, modelId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching personas by model",
      subject: { entityType: "personas" },
      context: { function: "_getPersonasByModel", file: "utils/queries/personas/get-personas-by-model.ts", foreignKey: "modelId", foreignId: String(modelId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getPersonasByModel = createMockableAction('getPersonasByModel', _getPersonasByModel);
