// utils/queries/standard_grades/get-standard-grades-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGradesByStandard(standardId: string) {
  try {
    return await db.select().from(standardGrades).where(eq(standardGrades.standardId, standardId));
  } catch (error) {
    console.error("Error fetching standard_grades by standard:", error);
    throw error;
  }
}
