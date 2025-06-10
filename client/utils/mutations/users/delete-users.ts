// utils/mutations/users/delete-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteUsers(ids: string[]) {
  try {
    return await db.delete(users).where(inArray(users.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple users:", error);
    throw error;
  }
}
