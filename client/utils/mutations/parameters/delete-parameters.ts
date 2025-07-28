// utils/mutations/parameters/delete-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteParameters(ids: string[]) {
  try {
    return await db.delete(parameters).where(inArray(parameters.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple parameters:", error);
    throw error;
  }
}
