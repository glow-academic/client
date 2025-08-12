// utils/queries/debug_info/get-debug-info-by-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getDebugInfoByModelRun(modelRunId: string) {
  try {
    return await db.select().from(debugInfo).where(eq(debugInfo.modelRunId, modelRunId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching debug_info by modelRun",
      subject: { entityType: "debug_info" },
      context: { function: "_getDebugInfoByModelRun", file: "utils/queries/debug_info/get-debug-info-by-model-run.ts", foreignKey: "modelRunId", foreignId: String(modelRunId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getDebugInfoByModelRun = createMockableAction('getDebugInfoByModelRun', _getDebugInfoByModelRun);
