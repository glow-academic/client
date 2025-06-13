// utils/queries/verificationToken/get-all-verification-token.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { verificationToken } from "@/drizzle/schema";

export async function getAllVerificationToken() {
  try {
    return await db.select().from(verificationToken);
  } catch (error) {
    console.error("Error fetching all verificationToken:", error);
    throw error;
  }
}
