// utils/queries/standard_grades/get-standard-grades-by-rubricGrades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGradesByRubricGrades(rubricGradeIds: string[]) {
  try {
    return await db.select().from(standardGrades).where(inArray(standardGrades.rubricGradeId, rubricGradeIds));
  } catch (error) {
    console.error("Error fetching standard_grades by rubricGrades:", error);
    throw error;
  }
}
