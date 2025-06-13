// utils/queries/account/get-all-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";

export async function getAllAccount() {
  try {
    return await db.select().from(account);
  } catch (error) {
    console.error("Error fetching all account:", error);
    throw error;
  }
}
