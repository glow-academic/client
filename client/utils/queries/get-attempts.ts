// utils/queries/get-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";

export async function getAttempts() {
  const fetchedAttempts = await db.select().from(attempts);
  return fetchedAttempts;
}
