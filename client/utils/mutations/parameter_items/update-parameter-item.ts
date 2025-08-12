// utils/mutations/parameter_items/update-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateParameterItem(id: string, data: Partial<typeof parameterItems.$inferInsert>) {
  try {
    const result = await db.update(parameterItems).set(data).where(eq(parameterItems.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating parameterItem",
      subject: { entityType: "parameter_items", entityId: String(id) },
      context: { function: "_updateParameterItem", file: "utils/mutations/parameter_items/update-parameter-item.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateParameterItem = createMockableAction('updateParameterItem', _updateParameterItem);
