// utils/queries/scenarios/get-scenarios-by-deadlines.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByDeadlines(deadlineIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.deadlineId, deadlineIds));
  } catch (error) {
    logError("Error fetching scenarios by deadlines:", error);
    throw error;
  }
}
