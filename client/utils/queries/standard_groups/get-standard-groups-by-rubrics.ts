// utils/queries/standard_groups/get-standard-groups-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGroupsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(standardGroups).where(inArray(standardGroups.rubric_id, rubricIds));
  } catch (error) {
    console.error("Error fetching standard_groups by rubrics:", error);
    throw error;
  }
}
