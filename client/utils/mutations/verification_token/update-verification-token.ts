// utils/mutations/verification_token/update-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";
import { and, eq, or } from "drizzle-orm";

export async function updateVerificationToken(
  tokens: Array<{identifier: string, token: string}>, 
  data: Partial<typeof verificationToken.$inferInsert>
) {
  try {
    const conditions = tokens.map(tokenData => 
      and(
        eq(verificationToken.identifier, tokenData.identifier),
        eq(verificationToken.token, tokenData.token)
      )
    );
    
    return await db.update(verificationToken)
      .set(data)
      .where(or(...conditions))
      .returning();
  } catch (error) {
    console.error("Error updating multiple verification_token:", error);
    throw error;
  }
}
