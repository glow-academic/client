// utils/queries/scenarios/get-all-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllScenarios() {
  try {
    return await db.select().from(scenarios);
  } catch (error) {
    logError("Error fetching all scenarios:", error);
    throw error;
  }
}
