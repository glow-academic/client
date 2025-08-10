// utils/queries/debug_info/get-debug-info-by-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDebugInfoByModelRun(modelRunId: string) {
  try {
    return await db.select().from(debugInfo).where(eq(debugInfo.modelRunId, modelRunId));
  } catch (error) {
    logError("Error fetching debug_info by modelRun:", error);
    throw error;
  }
}
