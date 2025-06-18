// utils/mutations/cohorts/delete-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteCohorts(ids: string[]) {
  try {
    return await db.delete(cohorts).where(inArray(cohorts.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple cohorts:", error);
    throw error;
  }
}
