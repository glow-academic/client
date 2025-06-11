// utils/queries/scenarios/get-scenarios-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getScenariosByClass(classIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.classId, classIds));
  } catch (error) {
    console.error("Error fetching scenarios by class:", error);
    throw error;
  }
}
