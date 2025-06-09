// utils/mutations/rubric_grades/delete-rubric-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteRubricGrades(ids: string[]) {
  try {
    return await db.delete(rubricGrades).where(inArray(rubricGrades.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple rubric_grades:", error);
    throw error;
  }
}
