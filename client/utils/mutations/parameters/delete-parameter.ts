// utils/mutations/parameters/delete-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteParameter(id: string) {
  try {
    const result = await db.delete(parameters).where(eq(parameters.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting parameter",
      subject: { entityType: "parameters", entityId: String(id) },
      context: { function: "_deleteParameter", file: "utils/mutations/parameters/delete-parameter.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteParameter = createMockableAction('deleteParameter', _deleteParameter);
