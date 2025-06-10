// utils/mutations/rubrics/delete-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteRubric(id: string) {
  try {
    const result = await db
      .delete(rubrics)
      .where(eq(rubrics.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting rubric:", error);
    throw error;
  }
}
