// utils/mutations/user/delete-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { user } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteUser(ids: string[]) {
  try {
    return await db.delete(user).where(inArray(user.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple user:", error);
    throw error;
  }
}
