// utils/queries/rubrics/get-rubrics-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getRubricsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(rubrics).where(inArray(rubrics.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching rubrics by rubrics:", error);
    throw error;
  }
}
