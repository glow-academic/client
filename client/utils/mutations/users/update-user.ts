// utils/mutations/users/update-user.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateUser(
  id: number,
  data: Partial<typeof users.$inferInsert>,
) {
  try {
    const result = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating user:", error);
    throw error;
  }
}
