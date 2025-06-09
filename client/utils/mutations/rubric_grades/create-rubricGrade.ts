// utils/mutations/rubric_grades/create-rubricGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";

export async function createRubricGrade(data: typeof rubricGrades.$inferInsert) {
  try {
    const result = await db.insert(rubricGrades).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating rubricGrade:", error);
    throw error;
  }
}
