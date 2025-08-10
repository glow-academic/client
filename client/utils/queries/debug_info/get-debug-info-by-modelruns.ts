// utils/queries/debug_info/get-debug-info-by-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDebugInfoByModelRuns(modelRunIds: string[]) {
  try {
    return await db.select().from(debugInfo).where(inArray(debugInfo.modelRunId, modelRunIds));
  } catch (error) {
    logError("Error fetching debug_info by modelRuns:", error);
    throw error;
  }
}
