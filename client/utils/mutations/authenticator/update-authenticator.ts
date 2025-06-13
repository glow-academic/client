// utils/mutations/authenticator/update-authenticator.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateAuthenticator(ids: string[], data: Partial<typeof authenticator.$inferInsert>) {
  try {
    return await db.update(authenticator).set(data).where(inArray(authenticator.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple authenticator:", error);
    throw error;
  }
}
