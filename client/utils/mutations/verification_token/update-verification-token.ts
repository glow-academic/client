// utils/mutations/verification_token/update-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateVerificationToken(ids: string[], data: Partial<typeof verificationToken.$inferInsert>) {
  try {
    return await db.update(verificationToken).set(data).where(inArray(verificationToken.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple verification_token:", error);
    throw error;
  }
}
