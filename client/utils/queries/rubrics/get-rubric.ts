// utils/queries/rubrics/get-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getRubric(id: string) {
  try {
    const result = await db.select().from(rubrics).where(eq(rubrics.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching rubric",
      subject: { entityType: "rubrics", entityId: String(id) },
      context: { function: "_getRubric", file: "utils/queries/rubrics/get-rubric.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getRubric = createMockableAction('getRubric', _getRubric);
