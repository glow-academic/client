// utils/queries/verificationToken/get-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getVerificationToken(id: string) {
  try {
    const result = await db.select().from(verificationToken).where(eq(verificationToken.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching verificationToken:", error);
    throw error;
  }
}
