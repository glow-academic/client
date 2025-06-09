// utils/queries/standard_grades/get-standard-grades-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGradesByStandards(standardIds: string[]) {
  try {
    return await db.select().from(standardGrades).where(inArray(standardGrades.standardId, standardIds));
  } catch (error) {
    console.error("Error fetching standard_grades by standards:", error);
    throw error;
  }
}
