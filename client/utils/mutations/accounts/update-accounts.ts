// utils/mutations/accounts/update-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateAccounts(ids: string[], data: Partial<typeof accounts.$inferInsert>) {
  try {
    return await db.update(accounts).set(data).where(inArray(accounts.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple accounts:", error);
    throw error;
  }
}
