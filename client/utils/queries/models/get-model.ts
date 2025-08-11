// utils/queries/models/get-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModel(id: string) {
  try {
    const result = await db.select().from(models).where(eq(models.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching model:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModel = createMockableAction('getModel', _getModel);
