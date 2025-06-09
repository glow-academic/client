// utils/queries/rubric_grades/get-rubric-grades-by-rubricids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getRubricGradesByRubricids(rubricidIds: string[]) {
  try {
    return await db.select().from(rubricGrades).where(inArray(rubricGrades.rubric_id, rubricidIds));
  } catch (error) {
    console.error("Error fetching rubric_grades by rubricids:", error);
    throw error;
  }
}
