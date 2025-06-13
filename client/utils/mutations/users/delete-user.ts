// utils/mutations/users/delete-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteUser(id: number) {
  try {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
