// utils/mutations/standard_grades/delete-standard-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteStandardGrades(ids: string[]) {
  try {
    return await db.delete(standardGrades).where(inArray(standardGrades.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple standard_grades:", error);
    throw error;
  }
}
