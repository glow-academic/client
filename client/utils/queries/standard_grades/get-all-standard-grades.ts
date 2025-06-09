// utils/queries/standard_grades/get-all-standard-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";

export async function getAllStandardGrades() {
  try {
    return await db.select().from(standardGrades);
  } catch (error) {
    console.error("Error fetching all standard_grades:", error);
    throw error;
  }
}
