// utils/mutations/parameters/create-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameters(data: (typeof parameters.$inferInsert)[]) {
  try {
    return await db.insert(parameters).values(data).returning();
  } catch (error) {
    logError("Error creating multiple parameters:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameters = createMockableAction('createParameters', _createParameters);
