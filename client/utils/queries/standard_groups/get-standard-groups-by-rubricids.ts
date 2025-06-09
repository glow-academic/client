// utils/queries/standard_groups/get-standard-groups-by-rubricids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardGroupsByRubricids(rubricidIds: string[]) {
  try {
    return await db.select().from(standardGroups).where(inArray(standardGroups.rubric_id, rubricidIds));
  } catch (error) {
    console.error("Error fetching standard_groups by rubricids:", error);
    throw error;
  }
}
