// utils/mutations/standard_grades/create-standard-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGrades } from "@/drizzle/schema";

export async function createStandardGrades(data: (typeof standardGrades.$inferInsert)[]) {
  try {
    return await db.insert(standardGrades).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple standard_grades:", error);
    throw error;
  }
}
