// utils/queries/accounts/get-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAccount(id: number) {
  try {
    const result = await db.select().from(accounts).where(eq(accounts.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching account:", error);
    throw error;
  }
}
