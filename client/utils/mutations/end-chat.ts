// utils/mutations/end-chat.ts
"use server"
import { eq } from 'drizzle-orm';
import { chats } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';

export async function endChat(chatId: string) {
    try {
        const chat = await db.update(chats).set({ completed: true }).where(eq(chats.id, chatId));
        if (!chat[0]) {
            throw new Error("Chat not found");
        }
        return { success: true, error: "" };
    } catch (error) {
        return { success: false, error: "Error ending chat: " + error };
    }
}
