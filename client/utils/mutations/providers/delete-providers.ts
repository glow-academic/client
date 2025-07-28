// utils/mutations/providers/delete-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteProviders(ids: string[]) {
  try {
    return await db.delete(providers).where(inArray(providers.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple providers:", error);
    throw error;
  }
}
