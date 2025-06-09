// utils/queries/standard_groups/get-standard-groups-by-rubricid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardGroupsByRubricid(rubricidId: string) {
  try {
    return await db.select().from(standardGroups).where(eq(standardGroups.rubric_id, rubricidId));
  } catch (error) {
    console.error("Error fetching standard_groups by rubricid:", error);
    throw error;
  }
}
