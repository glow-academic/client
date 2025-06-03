// utils/queries/get-templates.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getAttemptChats(attemptIds: string[]) {
  const fetchedAttemptChats = await db.select().from(chats).where(inArray(chats.attemptId, attemptIds));
  return fetchedAttemptChats;
}
