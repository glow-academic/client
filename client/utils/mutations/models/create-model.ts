// utils/mutations/models/create-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createModel(data: typeof models.$inferInsert) {
  try {
    const result = await db.insert(models).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating model",
      subject: { entityType: "models" },
      context: { function: "_createModel", file: "utils/mutations/models/create-model.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createModel = createMockableAction('createModel', _createModel);
