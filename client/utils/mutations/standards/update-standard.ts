// utils/mutations/standards/update-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateStandard(id: string, data: Partial<typeof standards.$inferInsert>) {
  try {
    const result = await db.update(standards).set(data).where(eq(standards.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating standard:", error);
    throw error;
  }
}
