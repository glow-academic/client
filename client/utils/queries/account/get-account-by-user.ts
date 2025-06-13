// utils/queries/account/get-account-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAccountByUser(userId: string) {
  try {
    return await db.select().from(account).where(eq(account.userId, userId));
  } catch (error) {
    console.error("Error fetching account by user:", error);
    throw error;
  }
}
