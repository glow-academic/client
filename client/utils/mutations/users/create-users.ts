// utils/mutations/users/create-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createUsers(data: (typeof users.$inferInsert)[]) {
  try {
    return await db.insert(users).values(data).returning();
  } catch (error) {
    logError("Error creating multiple users:", error);
    throw error;
  }
}
