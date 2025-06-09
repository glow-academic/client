// utils/mutations/rubric_grades/delete-rubricGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteRubricGrade(id: string) {
  try {
    const result = await db.delete(rubricGrades).where(eq(rubricGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting rubricGrade:", error);
    throw error;
  }
}
