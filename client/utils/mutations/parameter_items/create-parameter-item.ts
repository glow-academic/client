// utils/mutations/parameter_items/create-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createParameterItem(data: typeof parameterItems.$inferInsert) {
  try {
    const result = await db.insert(parameterItems).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating parameterItem",
      subject: { entityType: "parameter_items" },
      context: { function: "_createParameterItem", file: "utils/mutations/parameter_items/create-parameter-item.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createParameterItem = createMockableAction('createParameterItem', _createParameterItem);
