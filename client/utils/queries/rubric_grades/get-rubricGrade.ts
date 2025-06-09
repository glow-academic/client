// utils/queries/rubric_grades/get-rubricGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubricGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getRubricGrade(id: string) {
  try {
    const result = await db.select().from(rubricGrades).where(eq(rubricGrades.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching rubricGrade:", error);
    throw error;
  }
}
