// utils/mutations/verification_token/delete-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { and, eq, or } from "drizzle-orm";

export async function deleteVerificationToken(tokens: Array<{identifier: string, token: string}>) {
  try {
    const conditions = tokens.map(tokenData => 
      and(
        eq(verificationToken.identifier, tokenData.identifier),
        eq(verificationToken.token, tokenData.token)
      )
    );
    
    return await db.delete(verificationToken)
      .where(or(...conditions))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple verification_token:", error);
    throw error;
  }
}
