// utils/queries/scenarios/get-scenarios-by-deadline.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByDeadline(deadlineId: string) {
  try {
    return await db.select().from(scenarios).where(eq(scenarios.deadlineId, deadlineId));
  } catch (error) {
    logError("Error fetching scenarios by deadline:", error);
    throw error;
  }
}
