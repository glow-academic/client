// utils/queries/verification_token/get-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getVerificationToken(id: string) {
  try {
    const result = await db.select().from(verificationToken).where(eq(verificationToken.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching verificationToken:", error);
    throw error;
  }
}
