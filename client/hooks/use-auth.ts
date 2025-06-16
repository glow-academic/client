import { logError } from "@/utils/logger";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface MockSession {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  expires: string;
}

interface AuthData {
  userId: string | null;
  isAuthenticated: boolean;
  session: {
    data: Session | MockSession | null;
    status: "loading" | "authenticated" | "unauthenticated";
    update: (
      data?: Session | MockSession
    ) => Promise<Session | MockSession | null>;
  };
  status: "loading" | "authenticated" | "unauthenticated";
}

export function useAuth(): AuthData {
  const realSession = useSession();
  const [mockSession, setMockSession] = useState<MockSession | null>(null);
  const [isMockAuth, setIsMockAuth] = useState(false);

  useEffect(() => {
    // Check if we're using mock authentication
    const mockAuthFlag = localStorage.getItem("mockAuth");
    const storedMockSession = localStorage.getItem("mockSession");

    if (mockAuthFlag === "true" && storedMockSession) {
      try {
        const parsedSession = JSON.parse(storedMockSession);
        setMockSession(parsedSession);
        setIsMockAuth(true);
      } catch (error) {
        logError("Failed to parse mock session:", error);
        localStorage.removeItem("mockAuth");
        localStorage.removeItem("mockSession");
      }
    } else {
      setIsMockAuth(false);
      setMockSession(null);
    }
  }, []);

  // Return mock session data if in mock mode
  if (isMockAuth && mockSession) {
    return {
      userId: mockSession.user.id,
      isAuthenticated: true,
      session: {
        data: mockSession,
        status: "authenticated",
        update: () => Promise.resolve(mockSession),
      },
      status: "authenticated",
    };
  }

  // Return real session data
  return {
    userId: realSession.data?.user?.id || null,
    isAuthenticated: realSession.status === "authenticated",
    session: realSession,
    status: realSession.status,
  };
}
