// utils/mutations/rubric_grades/create-rubric-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";

export async function createRubricGrades(data: (typeof rubricGrades.$inferInsert)[]) {
  try {
    return await db.insert(rubricGrades).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple rubric_grades:", error);
    throw error;
  }
}
