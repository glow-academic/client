// utils/queries/rubrics/get-all-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllRubrics() {
  try {
    return await db.select().from(rubrics);
  } catch (error) {
    logError("Error fetching all rubrics:", error);
    throw error;
  }
}
