// utils/mutations/logout.ts
"use server"
import { cookies } from 'next/headers';

export async function logout() {
    try {
        // Clear the auth token cookie
        (await cookies()).delete('auth_token');
        return { success: true, error: ""};
    } catch (error) {
        return { success: false, error: "Error logging out: " + error};
    }
}
