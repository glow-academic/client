// utils/queries/parameter_items/get-parameter-items-by-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getParameterItemsByParameter(parameterId: string) {
  try {
    return await db.select().from(parameterItems).where(eq(parameterItems.parameterId, parameterId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching parameter_items by parameter",
      subject: { entityType: "parameter_items" },
      context: { function: "_getParameterItemsByParameter", file: "utils/queries/parameter_items/get-parameter-items-by-parameter.ts", foreignKey: "parameterId", foreignId: String(parameterId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getParameterItemsByParameter = createMockableAction('getParameterItemsByParameter', _getParameterItemsByParameter);
