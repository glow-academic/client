// utils/queries/rubrics/get-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getRubric(id: string) {
  try {
    const result = await db.select().from(rubrics).where(eq(rubrics.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching rubric:", error);
    throw error;
  }
}
