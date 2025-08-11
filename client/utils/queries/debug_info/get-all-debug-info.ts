// utils/queries/debug_info/get-all-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllDebugInfo() {
  try {
    return await db.select().from(debugInfo);
  } catch (error) {
    logError("Error fetching all debug_info:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllDebugInfo = createMockableAction('getAllDebugInfo', _getAllDebugInfo);
