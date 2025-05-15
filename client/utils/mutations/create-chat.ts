// utils/mutations/end-chat.ts
"use server"
import { chatProfile, chats } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';
import { chatTitles } from '../profiles';
import { chatScenarios } from '../profiles';

export async function createChat(profile: typeof chatProfile.enumValues[number], userId: string) {
    try {
        const title = chatTitles[profile];
        const scenarioDescription = chatScenarios[profile];
        const chat = await db.insert(chats).values({ profile, userId, title, scenarioDescription }).returning();
        if (!chat[0]) {
            throw new Error("Chat not found");
        }
        return { success: true, error: "", chatId: chat[0].id };
    } catch (error) {
        return { success: false, error: "Error creating chat: " + error, chatId: "" };
    }
}
