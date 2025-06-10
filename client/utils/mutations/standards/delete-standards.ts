// utils/mutations/standards/delete-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteStandards(ids: string[]) {
  try {
    return await db
      .delete(standards)
      .where(inArray(standards.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple standards:", error);
    throw error;
  }
}
