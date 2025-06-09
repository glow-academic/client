// utils/queries/standard_grades/get-standard-grades-by-standardids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGradesByStandardids(standardidIds: string[]) {
  try {
    return await db.select().from(standardGrades).where(inArray(standardGrades.standard_id, standardidIds));
  } catch (error) {
    console.error("Error fetching standard_grades by standardids:", error);
    throw error;
  }
}
