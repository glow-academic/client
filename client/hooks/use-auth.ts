// hooks/use-auth.ts
"use client";
import { useState, useEffect } from "react";
import { getAuthUser } from "@/utils/auth/get-auth-user";

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAuthUser() {
      try {
        setIsLoading(true);
        const user = await getAuthUser();
        setUserId(user?.id || null);
      } catch (error) {
        console.error("Error fetching auth user:", error);
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAuthUser();
  }, []);

  return {
    userId,
    isLoading,
    isAuthenticated: !!userId,
  };
}