// utils/queries/standard_groups/get-standard-groups-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getStandardGroupsByRubric(rubricId: string) {
  try {
    return await db.select().from(standardGroups).where(eq(standardGroups.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching standard_groups by rubric:", error);
    throw error;
  }
}
