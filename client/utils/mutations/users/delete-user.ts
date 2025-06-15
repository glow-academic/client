// utils/mutations/users/delete-user.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteUser(id: number) {
  try {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting user:", error);
    throw error;
  }
}
