// utils/mutations/models/delete-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModel(id: string) {
  try {
    const result = await db.delete(models).where(eq(models.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting model",
      subject: { entityType: "models", entityId: String(id) },
      context: { function: "_deleteModel", file: "utils/mutations/models/delete-model.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModel = createMockableAction('deleteModel', _deleteModel);
