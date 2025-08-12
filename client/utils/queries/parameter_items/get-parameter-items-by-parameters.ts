// utils/queries/parameter_items/get-parameter-items-by-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getParameterItemsByParameters(parameterIds: string[]) {
  try {
    return await db.select().from(parameterItems).where(inArray(parameterItems.parameterId, parameterIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching parameter_items by parameters",
      subject: { entityType: "parameter_items" },
      context: { function: "_getParameterItemsByParameters", file: "utils/queries/parameter_items/get-parameter-items-by-parameters.ts", foreignKey: "parameterId", foreignIdsCount: parameterIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getParameterItemsByParameters = createMockableAction('getParameterItemsByParameters', _getParameterItemsByParameters);
