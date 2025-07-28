// utils/mutations/scenarios/delete-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarios(ids: string[]) {
  try {
    return await db.delete(scenarios).where(inArray(scenarios.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenarios:", error);
    throw error;
  }
}
