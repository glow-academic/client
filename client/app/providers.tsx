// app/providers.tsx
"use client";

import { ProfileProvider } from "@/contexts/profile-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
  const { data: profile, isLoading: profileQueryLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(Number(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // ✅ "Really loading" = (session still loading) OR (profile still loading when we have a userId)
  const profileLoading =
    sessionStatus === "loading" || Boolean(userId && profileQueryLoading);
  const profileId = profileLoading ? undefined : (profile?.id as string | null);

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
          {children}
          <Toaster />
        </RoleAndWebSocketProviderWrapper>
      </QueryClientProvider>
    </SessionProvider>
  );
}
