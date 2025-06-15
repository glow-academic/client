// utils/mutations/accounts/create-account.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { accounts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAccount(data: typeof accounts.$inferInsert) {
  try {
    const result = await db.insert(accounts).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating account:", error);
    throw error;
  }
}
