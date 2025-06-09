// utils/queries/standard_grades/get-standard-grades-by-rubricgrades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGradesByRubricgrades(rubricgradeIds: string[]) {
  try {
    return await db.select().from(standardGrades).where(inArray(standardGrades.rubric_grade_id, rubricgradeIds));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricgrades:", error);
    throw error;
  }
}
