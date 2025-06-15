// utils/mutations/users/delete-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteUsers(ids: number[]) {
  try {
    return await db.delete(users).where(inArray(users.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple users:", error);
    throw error;
  }
}
