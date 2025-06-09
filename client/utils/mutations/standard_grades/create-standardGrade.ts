// utils/mutations/standard_grades/create-standardGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";

export async function createStandardGrade(data: typeof standardGrades.$inferInsert) {
  try {
    const result = await db.insert(standardGrades).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating standardGrade:", error);
    throw error;
  }
}
