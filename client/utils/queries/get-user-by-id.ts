"use server";
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getUserById(userId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user[0] || null;
} 