// utils/queries/parameter_items/get-parameter-items-by-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getParameterItemsByParameters(parameterIds: string[]) {
  try {
    return await db.select().from(parameterItems).where(inArray(parameterItems.parameterId, parameterIds));
  } catch (error) {
    logError("Error fetching parameter_items by parameters:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getParameterItemsByParameters = createMockableAction('getParameterItemsByParameters', _getParameterItemsByParameters);
