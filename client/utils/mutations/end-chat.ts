// utils/mutations/end-chat.ts
"use server"
import { eq } from 'drizzle-orm';
import { chats } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function endChat(chatId: string) {
    const db = drizzle(process.env.DATABASE_URL!);
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
