// utils/mutations/parameters/create-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameters(data: (typeof parameters.$inferInsert)[]) {
  try {
    return await db.insert(parameters).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple parameters",
      subject: { entityType: "parameters" },
      context: { function: "_createParameters", file: "utils/mutations/parameters/create-parameters.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameters = createMockableAction('createParameters', _createParameters);
