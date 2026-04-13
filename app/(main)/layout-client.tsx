/**
 * Client component for main layout.
 *
 * Global concerns only: sidebar, profile, socket, theme.
 * Page-level concerns (drafts, group, analytics filters, toolbars)
 * are owned by each page's own client component.
 */
"use client";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GenerationPanel } from "@/components/common/ai/GenerationPanel";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { GenerationPanelProvider } from "@/contexts/generation-panel-context";
import { GroupProviderClient } from "@/contexts/group-context";
import { ProfileProviderClient } from "@/contexts/profile-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import { SIDEBAR_SECTIONS } from "@/lib/sidebar-config";
import type {
  AuthProfileResponse,
  CreateFeedbackIn,
  CreateFeedbackOut,
  ExitEmulationResult,
  GroupMessagesIn,
  GroupMessagesOut,
  GroupSearchIn,
  GroupSearchOut,
  SafeSessionSnapshot,
  SearchProfilesIn,
  SearchProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "./layout-server";

// Inner component that uses the role context
function MainLayoutContent({
  children,
  initialSidebarOpen,
  switchEffectiveProfileAction,
  exitEmulationAction,
  createFeedbackAction,
  searchProfilesAction,
  searchGroupsAction,
  getGroupMessagesAction,
}: {
  children: React.ReactNode;
  initialSidebarOpen?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  exitEmulationAction: () => Promise<ExitEmulationResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  searchProfilesAction: (
    input: SearchProfilesIn
  ) => Promise<SearchProfilesOut>;
  searchGroupsAction: (
    input: GroupSearchIn
  ) => Promise<GroupSearchOut>;
  getGroupMessagesAction: (
    input: GroupMessagesIn
  ) => Promise<GroupMessagesOut>;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // Force layout server component to re-render when pathname changes.
  const prevPathnameRef = React.useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  // Derive active section (artifact name) from pathname by matching against sidebar URLs
  const activeSection = useMemo(() => {
    for (const route of SIDEBAR_SECTIONS) {
      if (route.items) {
        const child = route.items.find((item) => pathname.startsWith(item.url));
        if (child) return child.artifact;
      } else if (route.artifact && pathname.startsWith(route.url)) {
        return route.artifact;
      }
    }
    return "";
  }, [pathname]);

  const handleSectionChange = (section: string) => {
    // Look up the correct URL from client-side sidebar config
    let targetUrl = `/${section}`;
    for (const route of SIDEBAR_SECTIONS) {
      if (route.artifact === section) {
        targetUrl = route.url;
        break;
      }
      if (route.items) {
        const child = route.items.find((item) => item.artifact === section);
        if (child) {
          targetUrl = child.url;
          break;
        }
      }
    }
    router.push(targetUrl);
    router.refresh();
  };

  // AI panel — simple local state, no server action needed
  const [panelOpen, setPanelOpen] = useState(false);
  const togglePanel = useCallback(() => setPanelOpen(prev => !prev), []);

  return (
    <GenerationPanelProvider togglePanel={togglePanel} panelOpen={panelOpen}>
      <div className="flex min-h-svh w-full">
        <SidebarProvider defaultOpen={initialSidebarOpen ?? true}>
          <UnifiedSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            switchEffectiveProfile={switchEffectiveProfileAction}
            exitEmulation={exitEmulationAction}
            createFeedback={createFeedbackAction}
            searchProfiles={searchProfilesAction}
          />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
        <GenerationPanel panelOpen={panelOpen} onToggle={togglePanel} searchGroupsAction={searchGroupsAction} getGroupMessagesAction={getGroupMessagesAction} />
      </div>
    </GenerationPanelProvider>
  );
}

export function MainLayoutClient({
  children,
  profileData,
  sessionSnapshot,
  initialSidebarOpen,
  switchEffectiveProfileAction,
  exitEmulationAction,
  createFeedbackAction,
  searchProfilesAction,
  searchGroupsAction,
  getGroupMessagesAction,
}: {
  children: React.ReactNode;
  profileData: AuthProfileResponse | null;
  sessionSnapshot: SafeSessionSnapshot;
  /** Initial sidebar open state from SSR cookie */
  initialSidebarOpen?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  exitEmulationAction: () => Promise<ExitEmulationResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  searchProfilesAction: (
    input: SearchProfilesIn
  ) => Promise<SearchProfilesOut>;
  searchGroupsAction: (
    input: GroupSearchIn
  ) => Promise<GroupSearchOut>;
  getGroupMessagesAction: (
    input: GroupMessagesIn
  ) => Promise<GroupMessagesOut>;
}) {
  const pathname = usePathname();

  // Check if children contain UnifiedAccessDenied and force refresh if stale
  useEffect(() => {
    const checkAccessDenied = () => {
      const accessDeniedElement = document.querySelector(
        '[data-access-denied="true"]'
      );
      const wrapperElement = document.querySelector(
        `[data-route-pathname="${pathname}"]`
      );
      const wrapperPathname = wrapperElement?.getAttribute(
        "data-route-pathname"
      );

      if (
        pathname === "/practice" &&
        accessDeniedElement &&
        (wrapperPathname !== pathname || !wrapperElement)
      ) {
        window.location.href = pathname || "/";
      }
    };

    checkAccessDenied();
    const interval = setInterval(checkAccessDenied, 100);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <>
      <ThemeHydrator primitives={profileData?.theme ?? null} />
      <SocketProviderClient
        profileId={profileData?.id ?? null}
        idToken={sessionSnapshot?.idToken ?? null}
      >
        <ProfileProviderClient
          initial={profileData}
          sessionSnapshot={sessionSnapshot}
        >
          <GroupProviderClient initialGroupId={profileData?.group_id ?? null}>
          <MainLayoutContent
            initialSidebarOpen={initialSidebarOpen}
            switchEffectiveProfileAction={switchEffectiveProfileAction}
            exitEmulationAction={exitEmulationAction}
            createFeedbackAction={createFeedbackAction}
            searchProfilesAction={searchProfilesAction}
            searchGroupsAction={searchGroupsAction}
            getGroupMessagesAction={getGroupMessagesAction}
          >
            {children}
          </MainLayoutContent>
          </GroupProviderClient>
        </ProfileProviderClient>
      </SocketProviderClient>
    </>
  );
}
