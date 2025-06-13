// utils/mutations/users/update-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  try {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}
