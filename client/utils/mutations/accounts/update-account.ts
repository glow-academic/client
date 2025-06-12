// utils/mutations/accounts/update-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function updateAccount(
  provider: string, 
  providerAccountId: string, 
  data: Partial<typeof accounts.$inferInsert>
) {
  try {
    const result = await db.update(accounts)
      .set(data)
      .where(and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId)
      ))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating account:", error);
    throw error;
  }
}
