// utils/queries/users/get-user.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { users } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getUser(id: number) {
  try {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching user:", error);
    throw error;
  }
}
