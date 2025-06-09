// utils/queries/standard_grades/get-standard-grades-by-rubricgrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGradesByRubricgrade(rubricgradeId: string) {
  try {
    return await db.select().from(standardGrades).where(eq(standardGrades.rubric_grade_id, rubricgradeId));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricgrade:", error);
    throw error;
  }
}
