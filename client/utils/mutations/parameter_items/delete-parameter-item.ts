// utils/mutations/parameter_items/delete-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteParameterItem(id: string) {
  try {
    const result = await db.delete(parameterItems).where(eq(parameterItems.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting parameterItem",
      subject: { entityType: "parameter_items", entityId: String(id) },
      context: { function: "_deleteParameterItem", file: "utils/mutations/parameter_items/delete-parameter-item.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteParameterItem = createMockableAction('deleteParameterItem', _deleteParameterItem);
