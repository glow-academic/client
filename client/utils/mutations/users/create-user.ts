// utils/mutations/users/create-user.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createUser(data: typeof users.$inferInsert) {
  try {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating user:", error);
    throw error;
  }
}
