// utils/mutations/account/delete-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { account } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteAccount(ids: string[]) {
  try {
    return await db.delete(account).where(inArray(account.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple account:", error);
    throw error;
  }
}
