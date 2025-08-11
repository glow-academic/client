// utils/queries/rubrics/get-all-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllRubrics() {
  try {
    return await db.select().from(rubrics);
  } catch (error) {
    logError("Error fetching all rubrics:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllRubrics = createMockableAction('getAllRubrics', _getAllRubrics);
