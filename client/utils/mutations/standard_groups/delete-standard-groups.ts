// utils/mutations/standard_groups/delete-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteStandardGroups(ids: string[]) {
  try {
    return await db.delete(standardGroups).where(inArray(standardGroups.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple standard_groups:", error);
    throw error;
  }
}
