// utils/mutations/rubrics/update-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

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
    console.error("Error updating multiple rubrics:", error);
    throw error;
  }
}
