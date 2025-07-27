// utils/mutations/verification_token/create-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { verificationToken } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createVerificationToken(
  data: (typeof verificationToken.$inferInsert)[],
) {
  try {
    return await db.insert(verificationToken).values(data).returning();
  } catch (error) {
    logError("Error creating multiple verification_token:", error);
    throw error;
  }
}
