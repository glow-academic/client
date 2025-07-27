// utils/mutations/rubrics/delete-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteRubric(id: string) {
  try {
    const result = await db
      .delete(rubrics)
      .where(eq(rubrics.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting rubric:", error);
    throw error;
  }
}
