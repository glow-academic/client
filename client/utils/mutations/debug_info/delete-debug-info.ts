// utils/mutations/debug_info/delete-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteDebugInfo(ids: string[]) {
  try {
    return await db.delete(debugInfo).where(inArray(debugInfo.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple debug_info:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteDebugInfo = createMockableAction('deleteDebugInfo', _deleteDebugInfo);
