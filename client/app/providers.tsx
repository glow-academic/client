// app/providers.tsx
"use client";

import { DepartmentsProvider } from "@/contexts/departments-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { useProfilesByUserId } from "@/lib/api/v1/hooks/profiles";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "sonner";

const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

// Wrapper component to provide role context with user data and WebSocket connection
const RoleAndWebSocketProviderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id;
  const { data: profiles, isLoading: profileQueryLoading } =
    useProfilesByUserId(userId);
  const profile = profiles?.[0];

  // ✅ "Really loading" = (session still loading) OR (profile still loading when we have a userId)
  const profileLoading =
    sessionStatus === "loading" || Boolean(userId && profileQueryLoading);

  // For guest mode (no session), profileId should be null, not undefined
  const profileId = profileLoading ? undefined : profile?.id || null;

  return (
    <ProfileProvider
      activeProfile={profile ?? null}
      isProfileLoading={profileLoading}
    >
      <WebSocketProvider profileId={profileId}>{children}</WebSocketProvider>
    </ProfileProvider>
  );
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <SessionProvider basePath={`${appPrefix}/api/auth`}>
      <QueryClientProvider client={queryClient}>
        <RoleAndWebSocketProviderWrapper>
          <DepartmentsProvider>
            {children}
            <Toaster />
          </DepartmentsProvider>
        </RoleAndWebSocketProviderWrapper>
      </QueryClientProvider>
    </SessionProvider>
  );
}
