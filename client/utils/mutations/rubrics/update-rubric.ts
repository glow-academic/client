// utils/mutations/rubrics/update-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateRubric(
  id: string,
  data: Partial<typeof rubrics.$inferInsert>,
) {
  try {
    const result = await db
      .update(rubrics)
      .set(data)
      .where(eq(rubrics.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating rubric:", error);
    throw error;
  }
}
