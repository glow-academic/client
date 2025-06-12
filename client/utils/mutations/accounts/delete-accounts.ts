// utils/mutations/accounts/delete-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { and, eq, or } from "drizzle-orm";

export async function deleteAccounts(accountKeys: Array<{provider: string, providerAccountId: string}>) {
  try {
    const conditions = accountKeys.map(key => 
      and(
        eq(accounts.provider, key.provider),
        eq(accounts.providerAccountId, key.providerAccountId)
      )
    );
    
    return await db.delete(accounts)
      .where(or(...conditions))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple accounts:", error);
    throw error;
  }
}
