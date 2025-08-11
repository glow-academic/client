// utils/mutations/models/update-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateModel(id: string, data: Partial<typeof models.$inferInsert>) {
  try {
    const result = await db.update(models).set(data).where(eq(models.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating model:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateModel = createMockableAction('updateModel', _updateModel);
