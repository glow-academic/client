// utils/queries/account/get-account-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAccountByUsers(userIds: string[]) {
  try {
    return await db.select().from(account).where(inArray(account.userId, userIds));
  } catch (error) {
    console.error("Error fetching account by users:", error);
    throw error;
  }
}
