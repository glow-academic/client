// utils/mutations/scenarios/delete-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenario(id: string) {
  try {
    const result = await db.delete(scenarios).where(eq(scenarios.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenario:", error);
    throw error;
  }
}
