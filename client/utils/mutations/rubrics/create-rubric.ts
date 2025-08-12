// utils/mutations/rubrics/create-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createRubric(data: typeof rubrics.$inferInsert) {
  try {
    const result = await db.insert(rubrics).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating rubric",
      subject: { entityType: "rubrics" },
      context: { function: "_createRubric", file: "utils/mutations/rubrics/create-rubric.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createRubric = createMockableAction('createRubric', _createRubric);
