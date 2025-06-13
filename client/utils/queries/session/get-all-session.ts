// utils/queries/session/get-all-session.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { session } from "@/drizzle/schema";

export async function getAllSession() {
  try {
    return await db.select().from(session);
  } catch (error) {
    console.error("Error fetching all session:", error);
    throw error;
  }
}
