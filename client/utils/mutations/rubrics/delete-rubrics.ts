// utils/mutations/rubrics/delete-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteRubrics(ids: string[]) {
  try {
    return await db.delete(rubrics).where(inArray(rubrics.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple rubrics:", error);
    throw error;
  }
}
