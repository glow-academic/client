// utils/queries/users/get-all-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    logError("Error fetching all users:", error);
    throw error;
  }
}
