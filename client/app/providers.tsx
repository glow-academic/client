// app/providers.tsx
"use client";

import { createQueryClient } from "@/utils/react-query/queryClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { RoleProvider } from "@/contexts/role-context";
import { useQuery } from "@tanstack/react-query";
import { useSession, SessionProvider } from 'next-auth/react';
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getUserByEmail } from "@/utils/user/get-user-by-email";

const ReactQueryClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = useState(() => createQueryClient()); // Use a single instance
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Wrapper component to provide role context with user data
const RoleProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", userEmail],
    queryFn: () => getProfilesByUser(user!.id!),
    select: (data) => data[0],
    enabled: !!user,
  });

  return <RoleProvider ProfileRole={profile?.role}>{children}</RoleProvider>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ReactQueryClientProvider>
          <RoleProviderWrapper>
            {children}
            <Toaster />
          </RoleProviderWrapper>
        </ReactQueryClientProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
