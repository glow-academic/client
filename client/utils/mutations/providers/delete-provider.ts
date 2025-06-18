// utils/mutations/providers/delete-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteProvider(id: string) {
  try {
    const result = await db.delete(providers).where(eq(providers.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting provider:", error);
    throw error;
  }
}
