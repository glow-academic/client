// utils/mutations/parameter_items/create-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameterItem(data: typeof parameterItems.$inferInsert) {
  try {
    const result = await db.insert(parameterItems).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating parameterItem:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameterItem = createMockableAction('createParameterItem', _createParameterItem);
