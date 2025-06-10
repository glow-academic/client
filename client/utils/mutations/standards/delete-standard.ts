// utils/mutations/standards/delete-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteStandard(id: string) {
  try {
    const result = await db.delete(standards).where(eq(standards.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting standard:", error);
    throw error;
  }
}
