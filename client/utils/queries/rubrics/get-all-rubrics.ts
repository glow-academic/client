// utils/queries/rubrics/get-all-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllRubrics() {
  try {
    return await db.select().from(rubrics);
  } catch (error) {
    logError("Error fetching all rubrics:", error);
    throw error;
  }
}
