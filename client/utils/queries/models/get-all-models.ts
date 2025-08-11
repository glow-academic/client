// utils/queries/models/get-all-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllModels() {
  try {
    return await db.select().from(models);
  } catch (error) {
    logError("Error fetching all models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllModels = createMockableAction('getAllModels', _getAllModels);
