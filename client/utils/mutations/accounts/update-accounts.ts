// utils/mutations/accounts/update-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAccounts(ids: number[], data: Partial<typeof accounts.$inferInsert>) {
  try {
    return await db.update(accounts).set(data).where(inArray(accounts.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple accounts:", error);
    throw error;
  }
}
