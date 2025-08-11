// utils/queries/debug_info/get-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getDebugInfo(id: string) {
  try {
    const result = await db.select().from(debugInfo).where(eq(debugInfo.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching debugInfo:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getDebugInfo = createMockableAction('getDebugInfo', _getDebugInfo);
