// utils/mutations/rubrics/create-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createRubrics(data: (typeof rubrics.$inferInsert)[]) {
  try {
    return await db.insert(rubrics).values(data).returning();
  } catch (error) {
    logError("Error creating multiple rubrics:", error);
    throw error;
  }
}
