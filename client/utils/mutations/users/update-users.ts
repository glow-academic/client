// utils/mutations/users/update-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateUsers(
  ids: string[],
  data: Partial<typeof users.$inferInsert>,
) {
  try {
    return await db
      .update(users)
      .set(data)
      .where(inArray(users.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple users:", error);
    throw error;
  }
}
