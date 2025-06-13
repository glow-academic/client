// utils/mutations/authenticator/delete-authenticator.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteAuthenticator(ids: string[]) {
  try {
    return await db.delete(authenticator).where(inArray(authenticator.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple authenticator:", error);
    throw error;
  }
}
