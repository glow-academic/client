// utils/queries/standards/get-standards-by-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardsByStandardGroup(standardGroupId: string) {
  try {
    return await db.select().from(standards).where(eq(standards.standardGroupId, standardGroupId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching standards by standardGroup",
      subject: { entityType: "standards" },
      context: { function: "_getStandardsByStandardGroup", file: "utils/queries/standards/get-standards-by-standard-group.ts", foreignKey: "standardGroupId", foreignId: String(standardGroupId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardsByStandardGroup = createMockableAction('getStandardsByStandardGroup', _getStandardsByStandardGroup);
