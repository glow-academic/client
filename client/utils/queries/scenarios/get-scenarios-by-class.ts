// utils/queries/scenarios/get-scenarios-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByClass(classIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.classId, classIds));
  } catch (error) {
    logError("Error fetching scenarios by class:", error);
    throw error;
  }
}
