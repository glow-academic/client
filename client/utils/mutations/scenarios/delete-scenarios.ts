// utils/mutations/scenarios/delete-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteScenarios(ids: string[]) {
  try {
    return await db
      .delete(scenarios)
      .where(inArray(scenarios.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple scenarios:", error);
    throw error;
  }
}
