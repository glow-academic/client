// utils/queries/user/get-all-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { user } from "@/drizzle/schema";

export async function getAllUser() {
  try {
    return await db.select().from(user);
  } catch (error) {
    console.error("Error fetching all user:", error);
    throw error;
  }
}
