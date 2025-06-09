// utils/mutations/standard_grades/delete-standardGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteStandardGrade(id: string) {
  try {
    const result = await db.delete(standardGrades).where(eq(standardGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting standardGrade:", error);
    throw error;
  }
}
