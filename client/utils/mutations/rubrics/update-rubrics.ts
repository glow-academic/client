// utils/mutations/rubrics/update-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateRubrics(
  ids: string[],
  data: Partial<typeof rubrics.$inferInsert>,
) {
  try {
    return await db
      .update(rubrics)
      .set(data)
      .where(inArray(rubrics.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple rubrics:", error);
    throw error;
  }
}
