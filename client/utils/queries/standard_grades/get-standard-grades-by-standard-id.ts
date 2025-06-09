// utils/queries/standard_grades/get-standard-grades-by-standardid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGradesByStandardid(standardidId: string) {
  try {
    return await db.select().from(standardGrades).where(eq(standardGrades.standard_id, standardidId));
  } catch (error) {
    console.error("Error fetching standard_grades by standardid:", error);
    throw error;
  }
}
