// utils/mutations/debug_info/update-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateDebugInfo(ids: string[], data: Partial<typeof debugInfo.$inferInsert>) {
  try {
    return await db.update(debugInfo).set(data).where(inArray(debugInfo.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple debug_info:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateDebugInfo = createMockableAction('updateDebugInfo', _updateDebugInfo);
