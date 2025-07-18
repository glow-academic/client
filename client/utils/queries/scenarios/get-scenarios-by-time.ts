// utils/queries/scenarios/get-scenarios-by-time.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByTime(timeId: string) {
  try {
    return await db.select().from(scenarios).where(eq(scenarios.timeId, timeId));
  } catch (error) {
    logError("Error fetching scenarios by time:", error);
    throw error;
  }
}
