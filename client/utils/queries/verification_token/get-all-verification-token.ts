// utils/queries/verification_token/get-all-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { verificationToken } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllVerificationToken() {
  try {
    return await db.select().from(verificationToken);
  } catch (error) {
    logError("Error fetching all verification_token:", error);
    throw error;
  }
}
