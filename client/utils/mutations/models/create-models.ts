// utils/mutations/models/create-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createModels(data: (typeof models.$inferInsert)[]) {
  try {
    return await db.insert(models).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple models",
      subject: { entityType: "models" },
      context: { function: "_createModels", file: "utils/mutations/models/create-models.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createModels = createMockableAction('createModels', _createModels);
