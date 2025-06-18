// utils/mutations/providers/create-providers.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createProviders(data: (typeof providers.$inferInsert)[]) {
  try {
    return await db.insert(providers).values(data).returning();
  } catch (error) {
    logError("Error creating multiple providers:", error);
    throw error;
  }
}
