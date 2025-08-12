// utils/mutations/parameters/delete-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteParameters(ids: string[]) {
  try {
    return await db.delete(parameters).where(inArray(parameters.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple parameters",
      subject: { entityType: "parameters" },
      context: { function: "_deleteParameters", file: "utils/mutations/parameters/delete-parameters.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteParameters = createMockableAction('deleteParameters', _deleteParameters);
