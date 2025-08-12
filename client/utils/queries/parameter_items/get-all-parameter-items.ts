// utils/queries/parameter_items/get-all-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllParameterItems() {
  try {
    return await db.select().from(parameterItems);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all parameter_items",
      subject: { entityType: "parameter_items" },
      context: { function: "_getAllParameterItems", file: "utils/queries/parameter_items/get-all-parameter-items.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllParameterItems = createMockableAction('getAllParameterItems', _getAllParameterItems);
