// app/providers.tsx
"use client";

import { createQueryClient } from "@/utils/react-query/queryClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";


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


export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryClientProvider>
        {children}
        <Toaster />
      </ReactQueryClientProvider>
    </QueryClientProvider>
  );
}
