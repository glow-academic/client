// utils/queries/scenarios/get-scenarios-by-parents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByParents(parentIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.parentId, parentIds));
  } catch (error) {
    logError("Error fetching scenarios by parents:", error);
    throw error;
  }
}
