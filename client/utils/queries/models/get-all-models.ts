// utils/queries/models/get-all-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllModels() {
  try {
    return await db.select().from(models);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all models",
      subject: { entityType: "models" },
      context: { function: "_getAllModels", file: "utils/queries/models/get-all-models.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllModels = createMockableAction('getAllModels', _getAllModels);
