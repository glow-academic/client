// utils/queries/standard_grades/get-standard-grades-by-rubricGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGradesByRubricGrade(rubricGradeId: string) {
  try {
    return await db.select().from(standardGrades).where(eq(standardGrades.rubricGradeId, rubricGradeId));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricGrade:", error);
    throw error;
  }
}
