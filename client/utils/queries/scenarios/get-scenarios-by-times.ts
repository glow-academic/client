// utils/queries/scenarios/get-scenarios-by-times.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByTimes(timeIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.timeId, timeIds));
  } catch (error) {
    logError("Error fetching scenarios by times:", error);
    throw error;
  }
}
