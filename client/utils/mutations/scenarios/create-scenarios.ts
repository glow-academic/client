// utils/mutations/scenarios/create-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarios(data: (typeof scenarios.$inferInsert)[]) {
  try {
    return await db.insert(scenarios).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenarios:", error);
    throw error;
  }
}
