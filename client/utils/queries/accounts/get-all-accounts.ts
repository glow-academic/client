// utils/queries/accounts/get-all-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";

export async function getAllAccounts() {
  try {
    return await db.select().from(accounts);
  } catch (error) {
    console.error("Error fetching all accounts:", error);
    throw error;
  }
}
