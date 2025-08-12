// utils/queries/standard_groups/get-all-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllStandardGroups() {
  try {
    return await db.select().from(standardGroups);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all standard_groups",
      subject: { entityType: "standard_groups" },
      context: { function: "_getAllStandardGroups", file: "utils/queries/standard_groups/get-all-standard-groups.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllStandardGroups = createMockableAction('getAllStandardGroups', _getAllStandardGroups);
