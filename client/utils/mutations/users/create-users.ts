// utils/mutations/users/create-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";

export async function createUsers(data: (typeof users.$inferInsert)[]) {
  try {
    return await db.insert(users).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple users:", error);
    throw error;
  }
}
