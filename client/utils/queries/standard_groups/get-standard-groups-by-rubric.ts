// utils/queries/standard_groups/get-standard-groups-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGroupsByRubric(rubricId: string) {
  try {
    return await db.select().from(standardGroups).where(eq(standardGroups.rubric_id, rubricId));
  } catch (error) {
    console.error("Error fetching standard_groups by rubric:", error);
    throw error;
  }
}
