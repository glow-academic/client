// utils/queries/standards/get-all-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllStandards() {
  try {
    return await db.select().from(standards);
  } catch (error) {
    logError("Error fetching all standards:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllStandards = createMockableAction('getAllStandards', _getAllStandards);
