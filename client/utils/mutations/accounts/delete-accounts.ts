// utils/mutations/accounts/delete-accounts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { accounts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAccounts(ids: number[]) {
  try {
    return await db.delete(accounts).where(inArray(accounts.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple accounts:", error);
    throw error;
  }
}
