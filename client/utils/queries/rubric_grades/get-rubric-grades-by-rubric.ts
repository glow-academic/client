// utils/queries/rubric_grades/get-rubric-grades-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getRubricGradesByRubric(rubricId: string) {
  try {
    return await db.select().from(rubricGrades).where(eq(rubricGrades.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching rubric_grades by rubric:", error);
    throw error;
  }
}
