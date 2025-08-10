// utils/mutations/debug_info/create-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDebugInfo(data: (typeof debugInfo.$inferInsert)[]) {
  try {
    return await db.insert(debugInfo).values(data).returning();
  } catch (error) {
    logError("Error creating multiple debug_info:", error);
    throw error;
  }
}
