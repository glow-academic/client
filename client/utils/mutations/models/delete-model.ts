// utils/mutations/models/delete-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModel(id: string) {
  try {
    const result = await db.delete(models).where(eq(models.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting model:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModel = createMockableAction('deleteModel', _deleteModel);
