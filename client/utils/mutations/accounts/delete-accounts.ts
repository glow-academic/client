// utils/mutations/accounts/delete-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteAccounts(ids: number[]) {
  try {
    return await db.delete(accounts).where(inArray(accounts.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple accounts:", error);
    throw error;
  }
}
