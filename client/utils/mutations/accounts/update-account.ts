// utils/mutations/accounts/update-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateAccount(id: string, data: Partial<typeof accounts.$inferInsert>) {
  try {
    const result = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating account:", error);
    throw error;
  }
}
