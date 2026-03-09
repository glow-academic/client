/**
 * Client component for main layout (uses hooks)
 */
"use client";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo } from "react";

import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { DraftProviderClient, type DraftItem } from "@/contexts/draft-context";
import { GroupProviderClient } from "@/contexts/group-context";
import { ProfileProviderClient } from "@/contexts/profile-context";
import { SettingsProviderClient } from "@/contexts/settings-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import { SIDEBAR_SECTIONS } from "@/lib/sidebar-config";
import type {
  AnalyticsFiltersResponse,
  AuthProfileResponse,
  AuthSettingsResponse,
  CreateFeedbackIn,
  CreateFeedbackOut,
  SafeSessionSnapshot,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "./layout-server";

// Inner component that uses the role context
function MainLayoutContent({
  children,
  initialSidebarOpen,
  switchEffectiveProfileAction,
  createFeedbackAction,
  searchSimulatableProfilesAction,
}: {
  children: React.ReactNode;
  initialSidebarOpen?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
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

  // Derive active section from pathname
  const activeSection = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments[0] || "home";
  }, [pathname]);

  const handleSectionChange = (section: string) => {
    // Look up the correct URL from client-side sidebar config
    let targetUrl = `/${section}`;
    for (const route of SIDEBAR_SECTIONS) {
      if (route.section === section) {
        targetUrl = route.url;
        break;
      }
      if (route.items) {
        const child = route.items.find((item) => item.section === section);
        if (child) {
          targetUrl = child.url;
          break;
        }
      }
    }
    router.push(targetUrl);
    router.refresh();
  };

  return (
    <div className="flex min-h-svh w-full">
      <SidebarProvider defaultOpen={initialSidebarOpen ?? true}>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          switchEffectiveProfile={switchEffectiveProfileAction}
          createFeedback={createFeedbackAction}
          searchSimulatableProfiles={searchSimulatableProfilesAction}
        />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

export function MainLayoutClient({
  children,
  profileData,
  settingsData,
  sessionSnapshot,
  drafts,
  analyticsFilters,
  initialSidebarOpen,
  initialAutosave,
  switchEffectiveProfileAction,
  createFeedbackAction,
  searchSimulatableProfilesAction,
  groupId,
}: {
  children: React.ReactNode;
  profileData: AuthProfileResponse | null;
  settingsData: AuthSettingsResponse | null;
  sessionSnapshot: SafeSessionSnapshot;
  drafts: DraftItem[];
  analyticsFilters: AnalyticsFiltersResponse | null;
  /** Initial sidebar open state from SSR cookie */
  initialSidebarOpen?: boolean;
  /** Initial autosave preference from SSR cookie */
  initialAutosave?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  /** Resolved group_id from layout (null for non-artifact pages) */
  groupId: string | null;
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
      <ThemeHydrator tokens={settingsData?.tokens ?? null} />
      <SocketProviderClient
        profileId={profileData?.id ?? null}
        idToken={sessionSnapshot?.idToken ?? null}
      >
        <DraftProviderClient drafts={drafts} initialAutosave={initialAutosave}>
          <GroupProviderClient initialGroupId={groupId}>
            <ProfileProviderClient
              initial={profileData}
              sessionSnapshot={sessionSnapshot}
              analyticsFilters={analyticsFilters}
            >
              <SettingsProviderClient settings={settingsData}>
                <MainLayoutContent
                  initialSidebarOpen={initialSidebarOpen}
                  switchEffectiveProfileAction={switchEffectiveProfileAction}
                  createFeedbackAction={createFeedbackAction}
                  searchSimulatableProfilesAction={
                    searchSimulatableProfilesAction
                  }
                >
                  {children}
                </MainLayoutContent>
              </SettingsProviderClient>
            </ProfileProviderClient>
          </GroupProviderClient>
        </DraftProviderClient>
      </SocketProviderClient>
    </>
  );
}
