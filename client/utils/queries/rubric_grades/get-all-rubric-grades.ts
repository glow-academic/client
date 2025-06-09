// utils/queries/rubric_grades/get-all-rubric-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";

export async function getAllRubricGrades() {
  try {
    return await db.select().from(rubricGrades);
  } catch (error) {
    console.error("Error fetching all rubric_grades:", error);
    throw error;
  }
}
