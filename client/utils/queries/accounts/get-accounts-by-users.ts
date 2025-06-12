// utils/queries/accounts/get-accounts-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAccountsByUsers(userIds: string[]) {
  try {
    return await db.select().from(accounts).where(inArray(accounts.userId, userIds));
  } catch (error) {
    console.error("Error fetching accounts by users:", error);
    throw error;
  }
}
