// utils/mutations/account/create-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";

export async function createAccount(data: (typeof account.$inferInsert)[]) {
  try {
    return await db.insert(account).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple account:", error);
    throw error;
  }
}
