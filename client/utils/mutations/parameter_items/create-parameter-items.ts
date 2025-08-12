// utils/mutations/parameter_items/create-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameterItems(data: (typeof parameterItems.$inferInsert)[]) {
  try {
    return await db.insert(parameterItems).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple parameter_items",
      subject: { entityType: "parameter_items" },
      context: { function: "_createParameterItems", file: "utils/mutations/parameter_items/create-parameter-items.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameterItems = createMockableAction('createParameterItems', _createParameterItems);
