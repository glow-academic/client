// utils/mutations/verificationToken/create-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";

export async function createVerificationToken(data: (typeof verificationToken.$inferInsert)[]) {
  try {
    return await db.insert(verificationToken).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple verificationToken:", error);
    throw error;
  }
}
