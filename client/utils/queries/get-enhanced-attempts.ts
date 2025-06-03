"use server";
import { db } from "@/utils/drizzle/database";
import { attempts, templates, classes, users, chats, chatTemplates, profiles } from "@/drizzle/schema";
import { eq, inArray } from "drizzle-orm";

export async function getEnhancedAttempts() {
  // First get all attempts with their related template and class data
  const attemptsWithRelations = await db
    .select({
      id: attempts.id,
      createdAt: attempts.createdAt,
      userId: attempts.userId,
      classId: attempts.classId,
      templateId: attempts.templateId,
      templateTitle: templates.title,
      classCode: classes.classCode,
      className: classes.name,
      userName: users.name,
      chatTemplateIds: templates.chatTemplateIds,
    })
    .from(attempts)
    .leftJoin(templates, eq(attempts.templateId, templates.id))
    .leftJoin(classes, eq(attempts.classId, classes.id))
    .leftJoin(users, eq(attempts.userId, users.id));

  // Get all chats for these attempts
  const attemptIds = attemptsWithRelations.map(attempt => attempt.id);
  const allChats = await db
    .select({
      id: chats.id,
      attemptId: chats.attemptId,
      completed: chats.completed,
      scenarioId: chats.scenarioId,
      title: chats.title,
    })
    .from(chats)
    .where(inArray(chats.attemptId, attemptIds));

  // Get all chat templates and their profiles for the templates used in these attempts
  const allChatTemplateIds = attemptsWithRelations
    .flatMap(attempt => attempt.chatTemplateIds || [])
    .filter(Boolean);

  const chatTemplatesWithProfiles = await db
    .select({
      id: chatTemplates.id,
      profileId: chatTemplates.profileId,
      profileName: profiles.name,
    })
    .from(chatTemplates)
    .leftJoin(profiles, eq(chatTemplates.profileId, profiles.id))
    .where(inArray(chatTemplates.id, allChatTemplateIds));

  // Group chats by attempt ID
  const chatsByAttempt = allChats.reduce((acc, chat) => {
    if (!acc[chat.attemptId]) {
      acc[chat.attemptId] = [];
    }
    acc[chat.attemptId].push(chat);
    return acc;
  }, {} as Record<string, typeof allChats>);

  // Combine attempts with their chats and calculate profiles tested
  const enhancedAttempts = attemptsWithRelations.map(attempt => {
    const attemptChats = chatsByAttempt[attempt.id] || [];
    
    // Get profiles tested based on the template's chat template IDs
    const profilesTested = chatTemplatesWithProfiles
      .filter(ct => attempt.chatTemplateIds?.includes(ct.id))
      .map(ct => ct.profileName)
      .filter(Boolean);
    
    return {
      ...attempt,
      chats: attemptChats,
      profilesTested: [...new Set(profilesTested)], // Remove duplicates
    };
  });

  return enhancedAttempts;
} 