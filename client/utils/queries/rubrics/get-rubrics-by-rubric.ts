// utils/queries/rubrics/get-rubrics-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getRubricsByRubric(rubricId: string) {
  try {
    return await db.select().from(rubrics).where(eq(rubrics.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching rubrics by rubric:", error);
    throw error;
  }
}
