// utils/queries/parameter_items/get-all-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllParameterItems() {
  try {
    return await db.select().from(parameterItems);
  } catch (error) {
    logError("Error fetching all parameter_items:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllParameterItems = createMockableAction('getAllParameterItems', _getAllParameterItems);
