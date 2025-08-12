// utils/mutations/models/update-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateModels(ids: string[], data: Partial<typeof models.$inferInsert>) {
  try {
    return await db.update(models).set(data).where(inArray(models.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple models",
      subject: { entityType: "models" },
      context: { function: "_updateModels", file: "utils/mutations/models/update-models.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateModels = createMockableAction('updateModels', _updateModels);
