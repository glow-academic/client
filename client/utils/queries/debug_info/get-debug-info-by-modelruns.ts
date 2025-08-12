// utils/queries/debug_info/get-debug-info-by-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getDebugInfoByModelRuns(modelRunIds: string[]) {
  try {
    return await db.select().from(debugInfo).where(inArray(debugInfo.modelRunId, modelRunIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching debug_info by modelRuns",
      subject: { entityType: "debug_info" },
      context: { function: "_getDebugInfoByModelRuns", file: "utils/queries/debug_info/get-debug-info-by-model-runs.ts", foreignKey: "modelRunId", foreignIdsCount: modelRunIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getDebugInfoByModelRuns = createMockableAction('getDebugInfoByModelRuns', _getDebugInfoByModelRuns);
