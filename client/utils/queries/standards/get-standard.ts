// utils/queries/standards/get-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandard(id: string) {
  try {
    const result = await db.select().from(standards).where(eq(standards.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching standard",
      subject: { entityType: "standards", entityId: String(id) },
      context: { function: "_getStandard", file: "utils/queries/standards/get-standard.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandard = createMockableAction('getStandard', _getStandard);
