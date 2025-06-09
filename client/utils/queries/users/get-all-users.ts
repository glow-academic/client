// utils/queries/users/get-all-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";

export async function getAllUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
}
