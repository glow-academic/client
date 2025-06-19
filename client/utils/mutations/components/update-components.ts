// utils/mutations/components/update-components.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateComponents(ids: string[], data: Partial<typeof components.$inferInsert>) {
  try {
    return await db.update(components).set(data).where(inArray(components.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple components:", error);
    throw error;
  }
}
