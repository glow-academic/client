// utils/queries/scenarios/get-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenario(id: string) {
  try {
    const result = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching scenario:", error);
    throw error;
  }
}
