// utils/mutations/user/create-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { user } from "@/drizzle/schema";

export async function createUser(data: (typeof user.$inferInsert)[]) {
  try {
    return await db.insert(user).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple user:", error);
    throw error;
  }
}
