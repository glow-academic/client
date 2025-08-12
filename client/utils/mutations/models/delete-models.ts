// utils/mutations/models/delete-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModels(ids: string[]) {
  try {
    return await db.delete(models).where(inArray(models.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple models",
      subject: { entityType: "models" },
      context: { function: "_deleteModels", file: "utils/mutations/models/delete-models.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModels = createMockableAction('deleteModels', _deleteModels);
