// utils/queries/debug_info/get-debug-info.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDebugInfo(id: string) {
  try {
    const result = await db.select().from(debugInfo).where(eq(debugInfo.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching debugInfo:", error);
    throw error;
  }
}
