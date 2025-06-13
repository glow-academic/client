// utils/mutations/standard_groups/update-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateStandardGroups(ids: string[], data: Partial<typeof standardGroups.$inferInsert>) {
  try {
    return await db.update(standardGroups).set(data).where(inArray(standardGroups.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple standard_groups:", error);
    throw error;
  }
}
