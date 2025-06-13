// utils/mutations/accounts/delete-account.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { accounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAccount(id: number) {
  try {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting account:", error);
    throw error;
  }
}
