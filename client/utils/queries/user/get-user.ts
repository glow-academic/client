// utils/queries/user/get-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { user } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUser(id: string) {
  try {
    const result = await db.select().from(user).where(eq(user.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}
