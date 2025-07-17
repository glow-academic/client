// app/providers.tsx
"use client";

import { RoleProvider } from "@/contexts/role-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getQueryClient } from "@/utils/react-query/queryClient";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
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
  const userId = useSession().data?.user?.id;
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // profileId is undefined while loading, null if loaded and no profile, or the id if present
  const profileId =
    isLoading
      ? undefined
      : profile?.id ?? null;

  return (
    <RoleProvider ProfileRole={profile?.role}>
      <WebSocketProvider profileId={profileId}>{children}</WebSocketProvider>
    </RoleProvider>
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
