// utils/mutations/debug_info/delete-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDebugInfo(ids: string[]) {
  try {
    return await db.delete(debugInfo).where(inArray(debugInfo.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple debug_info:", error);
    throw error;
  }
}
