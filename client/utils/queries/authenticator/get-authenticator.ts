// utils/queries/authenticator/get-authenticator.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticator(id: string) {
  try {
    const result = await db.select().from(authenticator).where(eq(authenticator.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching authenticator:", error);
    throw error;
  }
}
