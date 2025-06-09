// utils/queries/rubric_grades/get-rubric-grades-by-rubricid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getRubricGradesByRubricid(rubricidId: string) {
  try {
    return await db.select().from(rubricGrades).where(eq(rubricGrades.rubric_id, rubricidId));
  } catch (error) {
    console.error("Error fetching rubric_grades by rubricid:", error);
    throw error;
  }
}
