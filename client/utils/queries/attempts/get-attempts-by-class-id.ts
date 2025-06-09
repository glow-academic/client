// utils/queries/attempts/get-attempts-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttemptsByClassid(classidId: string) {
  try {
    return await db.select().from(attempts).where(eq(attempts.class_id, classidId));
  } catch (error) {
    console.error("Error fetching attempts by classid:", error);
    throw error;
  }
}
