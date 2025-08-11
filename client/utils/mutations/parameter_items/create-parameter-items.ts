// utils/mutations/parameter_items/create-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameterItems(data: (typeof parameterItems.$inferInsert)[]) {
  try {
    return await db.insert(parameterItems).values(data).returning();
  } catch (error) {
    logError("Error creating multiple parameter_items:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameterItems = createMockableAction('createParameterItems', _createParameterItems);
