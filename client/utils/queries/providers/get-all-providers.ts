// utils/queries/providers/get-all-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllProviders() {
  try {
    return await db.select().from(providers);
  } catch (error) {
    logError("Error fetching all providers:", error);
    throw error;
  }
}
