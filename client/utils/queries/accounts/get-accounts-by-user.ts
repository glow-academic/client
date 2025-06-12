// utils/queries/accounts/get-accounts-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAccountsByUser(userId: string) {
  try {
    return await db.select().from(accounts).where(eq(accounts.userId, userId));
  } catch (error) {
    console.error("Error fetching accounts by user:", error);
    throw error;
  }
}
