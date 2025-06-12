// utils/mutations/accounts/delete-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deleteAccount(provider: string, providerAccountId: string) {
  try {
    const result = await db.delete(accounts)
      .where(and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId)
      ))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting account:", error);
    throw error;
  }
}
