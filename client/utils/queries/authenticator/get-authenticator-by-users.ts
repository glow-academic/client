// utils/queries/authenticator/get-authenticator-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { authenticator } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAuthenticatorByUsers(userIds: string[]) {
  try {
    return await db.select().from(authenticator).where(inArray(authenticator.userId, userIds));
  } catch (error) {
    console.error("Error fetching authenticator by users:", error);
    throw error;
  }
}
