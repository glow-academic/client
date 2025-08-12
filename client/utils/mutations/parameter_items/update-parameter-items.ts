// utils/mutations/parameter_items/update-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateParameterItems(ids: string[], data: Partial<typeof parameterItems.$inferInsert>) {
  try {
    return await db.update(parameterItems).set(data).where(inArray(parameterItems.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple parameter_items",
      subject: { entityType: "parameter_items" },
      context: { function: "_updateParameterItems", file: "utils/mutations/parameter_items/update-parameter-items.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateParameterItems = createMockableAction('updateParameterItems', _updateParameterItems);
