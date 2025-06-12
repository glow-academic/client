// utils/queries/accounts/get-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function getAccount(provider: string, providerAccountId: string) {
  try {
    const result = await db.select()
      .from(accounts)
      .where(and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId)
      ));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching account:", error);
    throw error;
  }
}
