/**
 * app/(main)/providers.tsx
 *
 * Hosts the long-lived Socket + Transport providers at the route-group
 * layout level so the WebSocket connection (and the transport's
 * subscription registry) **persist across client-side navigations
 * within /(main)/**. Previously these providers were inside
 * `FullPageLayout`, which re-mounts on every page change — that caused
 * the socket to disconnect/reconnect on every nav, dropping any
 * server-emitted events that fired during the reconnect window.
 *
 * Hard refreshes still drop the socket (browser-level reload), but
 * page-to-page navigation now keeps everything alive.
 *
 * `profileId` here is just a reconnect trigger — server resolves the
 * real profile from the JWT — so we use the auth `sub` claim
 * (session.user.id) which is stable across navigations.
 */
"use client";

import React from "react";
import { SocketProviderClient } from "@/contexts/socket-context";
import { TransportProvider } from "@/lib/transport";

interface MainProvidersProps {
  children: React.ReactNode;
  profileId: string | null;
}

export function MainProviders({ children, profileId }: MainProvidersProps) {
  return (
    <SocketProviderClient profileId={profileId}>
      {/* `authToken` for the SSE transport is a legacy no-op — the SSE BFF
          route (`/api/watch/[artifact]`) attaches the Bearer server-side,
          so no token is passed to the client transport. */}
      <TransportProvider>{children}</TransportProvider>
    </SocketProviderClient>
  );
}
