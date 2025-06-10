// utils/mutations/standards/update-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateStandards(ids: string[], data: Partial<typeof standards.$inferInsert>) {
  try {
    return await db.update(standards).set(data).where(inArray(standards.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple standards:", error);
    throw error;
  }
}
