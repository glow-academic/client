// utils/mutations/rubric_grades/update-rubricGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateRubricGrade(id: string, data: Partial<typeof rubricGrades.$inferInsert>) {
  try {
    const result = await db.update(rubricGrades).set(data).where(eq(rubricGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating rubricGrade:", error);
    throw error;
  }
}
