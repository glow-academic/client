// utils/mutations/parameters/update-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateParameter(id: string, data: Partial<typeof parameters.$inferInsert>) {
  try {
    const result = await db.update(parameters).set(data).where(eq(parameters.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating parameter",
      subject: { entityType: "parameters", entityId: String(id) },
      context: { function: "_updateParameter", file: "utils/mutations/parameters/update-parameter.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateParameter = createMockableAction('updateParameter', _updateParameter);
