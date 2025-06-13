// utils/mutations/verification_token/delete-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteVerificationToken(ids: string[]) {
  try {
    return await db.delete(verificationToken).where(inArray(verificationToken.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple verification_token:", error);
    throw error;
  }
}
