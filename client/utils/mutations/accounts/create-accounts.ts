// utils/mutations/accounts/create-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAccounts(data: (typeof accounts.$inferInsert)[]) {
  try {
    return await db.insert(accounts).values(data).returning();
  } catch (error) {
    logError("Error creating multiple accounts:", error);
    throw error;
  }
}
