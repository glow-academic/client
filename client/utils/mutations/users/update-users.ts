// utils/mutations/users/update-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateUsers(ids: number[], data: Partial<typeof users.$inferInsert>) {
  try {
    return await db.update(users).set(data).where(inArray(users.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple users:", error);
    throw error;
  }
}
