// utils/mutations/standard_grades/update-standardGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateStandardGrade(id: string, data: Partial<typeof standardGrades.$inferInsert>) {
  try {
    const result = await db.update(standardGrades).set(data).where(eq(standardGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating standardGrade:", error);
    throw error;
  }
}
