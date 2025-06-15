// utils/mutations/standards/update-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateStandards(ids: string[], data: Partial<typeof standards.$inferInsert>) {
  try {
    return await db.update(standards).set(data).where(inArray(standards.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple standards:", error);
    throw error;
  }
}
