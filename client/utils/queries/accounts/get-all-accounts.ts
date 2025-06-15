// utils/queries/accounts/get-all-accounts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { accounts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAccounts() {
  try {
    return await db.select().from(accounts);
  } catch (error) {
    logError("Error fetching all accounts:", error);
    throw error;
  }
}
