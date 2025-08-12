// utils/queries/rubrics/get-all-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllRubrics() {
  try {
    return await db.select().from(rubrics);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all rubrics",
      subject: { entityType: "rubrics" },
      context: { function: "_getAllRubrics", file: "utils/queries/rubrics/get-all-rubrics.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllRubrics = createMockableAction('getAllRubrics', _getAllRubrics);
