// utils/queries/get-messages.ts
"use server"
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { messages } from '@/drizzle/schema';

export async function getMessages(chatId: string) {
    const db = drizzle(process.env.DATABASE_URL!);

    const chatMessages = await db.select().from(messages).where(eq(messages.chat_id, chatId));
    return chatMessages;
}
