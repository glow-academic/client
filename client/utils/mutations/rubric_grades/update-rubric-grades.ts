// utils/mutations/rubric_grades/update-rubric-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateRubricGrades(ids: string[], data: Partial<typeof rubricGrades.$inferInsert>) {
  try {
    return await db.update(rubricGrades).set(data).where(inArray(rubricGrades.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple rubric_grades:", error);
    throw error;
  }
}
