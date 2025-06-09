// utils/queries/rubric_grades/get-rubric-grades-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getRubricGradesByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(rubricGrades).where(inArray(rubricGrades.rubric_id, rubricIds));
  } catch (error) {
    console.error("Error fetching rubric_grades by rubrics:", error);
    throw error;
  }
}
