// utils/queries/authenticator/get-all-authenticator.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";

export async function getAllAuthenticator() {
  try {
    return await db.select().from(authenticator);
  } catch (error) {
    console.error("Error fetching all authenticator:", error);
    throw error;
  }
}
