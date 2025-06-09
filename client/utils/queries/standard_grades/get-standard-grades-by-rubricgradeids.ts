// utils/queries/standard_grades/get-standard-grades-by-rubricgradeids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGradesByRubricgradeids(rubricgradeidIds: string[]) {
  try {
    return await db.select().from(standardGrades).where(inArray(standardGrades.rubric_grade_id, rubricgradeidIds));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricgradeids:", error);
    throw error;
  }
}
