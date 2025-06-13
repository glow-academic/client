// utils/mutations/authenticator/create-authenticator.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";

export async function createAuthenticator(data: (typeof authenticator.$inferInsert)[]) {
  try {
    return await db.insert(authenticator).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple authenticator:", error);
    throw error;
  }
}
