// utils/queries/get-chats.ts
"use server";
import { eq, inArray } from "drizzle-orm";
import { attempts, chats} from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getChats(userId: string) {
  // first find the attemps
  const userAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, userId));

  const userChats = await db.select().from(chats).where(inArray(chats.attemptId, userAttempts.map(attempt => attempt.id)));
  return userChats;
}
