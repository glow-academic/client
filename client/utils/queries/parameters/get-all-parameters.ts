// utils/queries/parameters/get-all-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllParameters() {
  try {
    return await db.select().from(parameters);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all parameters",
      subject: { entityType: "parameters" },
      context: { function: "_getAllParameters", file: "utils/queries/parameters/get-all-parameters.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllParameters = createMockableAction('getAllParameters', _getAllParameters);
