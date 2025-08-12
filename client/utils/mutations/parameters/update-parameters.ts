// utils/mutations/parameters/update-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateParameters(ids: string[], data: Partial<typeof parameters.$inferInsert>) {
  try {
    return await db.update(parameters).set(data).where(inArray(parameters.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple parameters",
      subject: { entityType: "parameters" },
      context: { function: "_updateParameters", file: "utils/mutations/parameters/update-parameters.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateParameters = createMockableAction('updateParameters', _updateParameters);
