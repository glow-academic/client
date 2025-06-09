// utils/mutations/standard_grades/update-standard-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateStandardGrades(ids: string[], data: Partial<typeof standardGrades.$inferInsert>) {
  try {
    return await db.update(standardGrades).set(data).where(inArray(standardGrades.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple standard_grades:", error);
    throw error;
  }
}
