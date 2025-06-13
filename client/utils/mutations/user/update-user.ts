// utils/mutations/user/update-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { user } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateUser(ids: string[], data: Partial<typeof user.$inferInsert>) {
  try {
    return await db.update(user).set(data).where(inArray(user.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple user:", error);
    throw error;
  }
}
