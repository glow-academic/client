// utils/mutations/parameters/create-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameter(data: typeof parameters.$inferInsert) {
  try {
    const result = await db.insert(parameters).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating parameter",
      subject: { entityType: "parameters" },
      context: { function: "_createParameter", file: "utils/mutations/parameters/create-parameter.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameter = createMockableAction('createParameter', _createParameter);
