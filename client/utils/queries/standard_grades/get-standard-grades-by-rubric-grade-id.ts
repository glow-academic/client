// utils/queries/standard_grades/get-standard-grades-by-rubricgradeid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGradesByRubricgradeid(rubricgradeidId: string) {
  try {
    return await db.select().from(standardGrades).where(eq(standardGrades.rubric_grade_id, rubricgradeidId));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricgradeid:", error);
    throw error;
  }
}
