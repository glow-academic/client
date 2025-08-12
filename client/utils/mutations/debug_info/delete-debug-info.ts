// utils/mutations/debug_info/delete-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteDebugInfo(ids: string[]) {
  try {
    return await db.delete(debugInfo).where(inArray(debugInfo.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple debug_info",
      subject: { entityType: "debug_info" },
      context: { function: "_deleteDebugInfo", file: "utils/mutations/debug_info/delete-debug-info.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteDebugInfo = createMockableAction('deleteDebugInfo', _deleteDebugInfo);
