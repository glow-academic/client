// utils/queries/account/get-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAccount(id: string) {
  try {
    const result = await db.select().from(account).where(eq(account.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching account:", error);
    throw error;
  }
}
