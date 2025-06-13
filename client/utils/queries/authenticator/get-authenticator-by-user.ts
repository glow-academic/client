// utils/queries/authenticator/get-authenticator-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticatorByUser(userId: string) {
  try {
    return await db.select().from(authenticator).where(eq(authenticator.userId, userId));
  } catch (error) {
    console.error("Error fetching authenticator by user:", error);
    throw error;
  }
}
