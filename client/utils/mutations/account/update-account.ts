// utils/mutations/account/update-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateAccount(ids: string[], data: Partial<typeof account.$inferInsert>) {
  try {
    return await db.update(account).set(data).where(inArray(account.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple account:", error);
    throw error;
  }
}
