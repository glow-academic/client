// utils/mutations/models/create-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createModels(data: (typeof models.$inferInsert)[]) {
  try {
    return await db.insert(models).values(data).returning();
  } catch (error) {
    logError("Error creating multiple models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createModels = createMockableAction('createModels', _createModels);
