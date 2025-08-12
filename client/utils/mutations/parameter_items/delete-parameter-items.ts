// utils/mutations/parameter_items/delete-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteParameterItems(ids: string[]) {
  try {
    return await db.delete(parameterItems).where(inArray(parameterItems.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple parameter_items",
      subject: { entityType: "parameter_items" },
      context: { function: "_deleteParameterItems", file: "utils/mutations/parameter_items/delete-parameter-items.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteParameterItems = createMockableAction('deleteParameterItems', _deleteParameterItems);
