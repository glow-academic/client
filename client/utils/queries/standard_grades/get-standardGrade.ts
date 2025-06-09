// utils/queries/standard_grades/get-standardGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGrade(id: string) {
  try {
    const result = await db.select().from(standardGrades).where(eq(standardGrades.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching standardGrade:", error);
    throw error;
  }
}
