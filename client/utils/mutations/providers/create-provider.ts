// utils/mutations/providers/create-provider.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createProvider(data: typeof providers.$inferInsert) {
  try {
    const result = await db.insert(providers).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating provider:", error);
    throw error;
  }
}
