// utils/mutations/rubrics/create-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";

export async function createRubric(data: typeof rubrics.$inferInsert) {
  try {
    const result = await db.insert(rubrics).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating rubric:", error);
    throw error;
  }
}
