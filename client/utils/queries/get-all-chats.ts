// utils/queries/get-all-chats.ts
"use server";
import { eq } from "drizzle-orm";
import { chats, attempts, users, classes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getAllChats() {
  // Get all chats with related user and class information
  const allChats = await db
    .select({
      id: chats.id,
      createdAt: chats.createdAt,
      completedAt: chats.completedAt,
      title: chats.title,
      scenarioId: chats.scenarioId,
      profileId: chats.profileId,
      chatTemplateId: chats.chatTemplateId,
      completed: chats.completed,
      attemptId: chats.attemptId,
      // Add user and class information from attempts
      userId: attempts.userId,
      classId: attempts.classId,
      userName: users.name,
      classCode: classes.classCode,
    })
    .from(chats)
    .leftJoin(attempts, eq(chats.attemptId, attempts.id))
    .leftJoin(users, eq(attempts.userId, users.id))
    .leftJoin(classes, eq(attempts.classId, classes.id));

  return allChats;
}
