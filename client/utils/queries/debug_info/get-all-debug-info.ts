// utils/queries/debug_info/get-all-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllDebugInfo() {
  try {
    return await db.select().from(debugInfo);
  } catch (error) {
    logError("Error fetching all debug_info:", error);
    throw error;
  }
}
