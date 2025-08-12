// utils/mutations/debug_info/create-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createDebugInfo(data: (typeof debugInfo.$inferInsert)[]) {
  try {
    return await db.insert(debugInfo).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple debug_info",
      subject: { entityType: "debug_info" },
      context: { function: "_createDebugInfo", file: "utils/mutations/debug_info/create-debug-info.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createDebugInfo = createMockableAction('createDebugInfo', _createDebugInfo);
