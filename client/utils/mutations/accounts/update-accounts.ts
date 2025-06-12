// utils/mutations/accounts/update-accounts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { and, eq, or } from "drizzle-orm";

export async function updateAccounts(
  accountKeys: Array<{provider: string, providerAccountId: string}>, 
  data: Partial<typeof accounts.$inferInsert>
) {
  try {
    const conditions = accountKeys.map(key => 
      and(
        eq(accounts.provider, key.provider),
        eq(accounts.providerAccountId, key.providerAccountId)
      )
    );
    
    return await db.update(accounts)
      .set(data)
      .where(or(...conditions))
      .returning();
  } catch (error) {
    console.error("Error updating multiple accounts:", error);
    throw error;
  }
}
