// utils/mutations/end-chat.ts
"use server"
import { chatProfile, chats } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { chatTitles } from '../profiles';
import { chatScenarios } from '../profiles';

export async function createChat(profile: typeof chatProfile.enumValues[number], userId: string) {
    const db = drizzle(process.env.DATABASE_URL!);
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
