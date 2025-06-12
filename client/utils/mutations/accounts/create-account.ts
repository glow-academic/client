// utils/mutations/accounts/create-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";

export async function createAccount(data: typeof accounts.$inferInsert) {
  try {
    const result = await db.insert(accounts).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating account:", error);
    throw error;
  }
}
