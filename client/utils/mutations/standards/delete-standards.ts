// utils/mutations/standards/delete-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteStandards(ids: string[]) {
  try {
    return await db
      .delete(standards)
      .where(inArray(standards.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple standards:", error);
    throw error;
  }
}
