// utils/mutations/components/delete-components.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteComponents(ids: string[]) {
  try {
    return await db.delete(components).where(inArray(components.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple components:", error);
    throw error;
  }
}
