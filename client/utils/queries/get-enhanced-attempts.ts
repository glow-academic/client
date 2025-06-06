"use server";
import { db } from "@/utils/drizzle/database";
import { attempts, simulations, classes, users, chats, interactions, agents } from "@/drizzle/schema";
import { eq, inArray } from "drizzle-orm";

export async function getEnhancedAttempts() {
  // First get all attempts with their related simulation and class data
  const attemptsWithRelations = await db
    .select({
      id: attempts.id,
      createdAt: attempts.createdAt,
      userId: attempts.userId,
      classId: attempts.classId,
      simulationId: attempts.simulationId,
      simulationTitle: simulations.title,
      classCode: classes.classCode,
      className: classes.name,
      userName: users.name,
      interactionIds: simulations.interactionIds,
    })
    .from(attempts)
    .leftJoin(simulations, eq(attempts.simulationId, simulations.id))
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

  // Get all interactions and their agents for the simulations used in these attempts
  const allInteractionIds = attemptsWithRelations
    .flatMap(attempt => attempt.interactionIds || [])
    .filter(Boolean);

  const interactionsWithAgents = await db
    .select({
      id: interactions.id,
      agentId: interactions.agentId,
      agentName: agents.name,
    })
    .from(interactions)
    .leftJoin(agents, eq(interactions.agentId, agents.id))
    .where(inArray(interactions.id, allInteractionIds));

  // Group chats by attempt ID
  const chatsByAttempt = allChats.reduce((acc, chat) => {
    if (!acc[chat.attemptId]) {
      acc[chat.attemptId] = [];
    }
    acc[chat.attemptId].push(chat);
    return acc;
  }, {} as Record<string, typeof allChats>);

  // Combine attempts with their chats and calculate agents tested
  const enhancedAttempts = attemptsWithRelations.map(attempt => {
    const attemptChats = chatsByAttempt[attempt.id] || [];
    
    // Get agents tested based on the simulation's interaction IDs
    const agentsTested = interactionsWithAgents
      .filter(interaction => attempt.interactionIds?.includes(interaction.id))
      .map(interaction => interaction.agentName)
      .filter(Boolean);
    
    return {
      ...attempt,
      chats: attemptChats,
      agentsTested: [...new Set(agentsTested)], // Remove duplicates
    };
  });

  return enhancedAttempts;
}

export async function getEnhancedAttemptsByUser(userId: string) {
  // First get attempts for specific user with their related simulation and class data
  const attemptsWithRelations = await db
    .select({
      id: attempts.id,
      createdAt: attempts.createdAt,
      userId: attempts.userId,
      classId: attempts.classId,
      simulationId: attempts.simulationId,
      simulationTitle: simulations.title,
      classCode: classes.classCode,
      className: classes.name,
      userName: users.name,
      interactionIds: simulations.interactionIds,
    })
    .from(attempts)
    .leftJoin(simulations, eq(attempts.simulationId, simulations.id))
    .leftJoin(classes, eq(attempts.classId, classes.id))
    .leftJoin(users, eq(attempts.userId, users.id))
    .where(eq(attempts.userId, userId));

  // Get all chats for these attempts
  const attemptIds = attemptsWithRelations.map(attempt => attempt.id);
  
  if (attemptIds.length === 0) {
    return [];
  }

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

  // Get all interactions and their agents for the simulations used in these attempts
  const allInteractionIds = attemptsWithRelations
    .flatMap(attempt => attempt.interactionIds || [])
    .filter(Boolean);

  let interactionsWithAgents: any[] = [];
  if (allInteractionIds.length > 0) {
    interactionsWithAgents = await db
      .select({
        id: interactions.id,
        agentId: interactions.agentId,
        agentName: agents.name,
      })
      .from(interactions)
      .leftJoin(agents, eq(interactions.agentId, agents.id))
      .where(inArray(interactions.id, allInteractionIds));
  }

  // Group chats by attempt ID
  const chatsByAttempt = allChats.reduce((acc, chat) => {
    if (!acc[chat.attemptId]) {
      acc[chat.attemptId] = [];
    }
    acc[chat.attemptId].push(chat);
    return acc;
  }, {} as Record<string, typeof allChats>);

  // Combine attempts with their chats and calculate agents tested
  const enhancedAttempts = attemptsWithRelations.map(attempt => {
    const attemptChats = chatsByAttempt[attempt.id] || [];
    
    // Get agents tested based on the simulation's interaction IDs
    const agentsTested = interactionsWithAgents
      .filter(interaction => attempt.interactionIds?.includes(interaction.id))
      .map(interaction => interaction.agentName)
      .filter(Boolean);
    
    return {
      ...attempt,
      chats: attemptChats,
      agentsTested: [...new Set(agentsTested)], // Remove duplicates
    };
  });

  return enhancedAttempts;
} 