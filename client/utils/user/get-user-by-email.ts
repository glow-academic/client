// utils/user/get-user-by-email.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getUserByEmail(email: string) {
  try {
    // Validate email parameter
    if (!email || typeof email !== 'string' || email.trim() === '') {
      console.warn("getUserByEmail called with invalid email:", email);
      return null;
    }

    const result = await db.select().from(users).where(eq(users.email, email.trim()));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}
