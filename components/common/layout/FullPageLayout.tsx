/**
 * FullPageLayout — general-purpose page layout with left sidebar, header, and right panel.
 *
 * Each artifact page renders this directly from page.tsx (server component) with
 * artifact-specific props. Replaces the layout-level sidebar/panel rendering.
 *
 * Interface: sidebarProps (left), breadcrumbs+toolbar (middle header), panelProps (right), children (content).
 */
"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { PageHeader, type BreadcrumbItem } from "@/components/common/layout/PageHeader";
import { GenerationPanel } from "@/components/common/ai/GenerationPanel";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { ProfileProviderClient } from "@/contexts/profile-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import { GroupProviderClient } from "@/contexts/group-context";
import { SIDEBAR_SECTIONS } from "@/lib/sidebar-config";

import type {
  AuthProfileResponse,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
  activeSection: string;
  createFeedback: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface PanelProps {
  artifactType: string;
  groupId: string | null;
  generateAction: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  permissions: Array<{ artifact: string; operation: string }>;
  getGroupHistory: (groupId: string) => Promise<Record<string, unknown>>;
  searchGroups: (query: string) => Promise<Record<string, unknown>>;
}

export interface FullPageLayoutProps {
  // Auth/providers
  profileData: AuthProfileResponse | null;
  sessionSnapshot: SafeSessionSnapshot;
  // Cookie-based initial state
  initialSidebarOpen?: boolean;
  initialPanelOpen?: boolean;
  // Left sidebar
  sidebarProps: SidebarProps;
  // Middle header
  breadcrumbs: BreadcrumbItem[];
  toolbar?: React.ReactNode;
  // Right panel (omit for pages without a generation panel)
  panelProps?: PanelProps;
  // Content
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FullPageLayout({
  profileData,
  sessionSnapshot,
  initialSidebarOpen,
  initialPanelOpen,
  sidebarProps,
  breadcrumbs,
  toolbar,
  panelProps,
  children,
}: FullPageLayoutProps) {
  const router = useRouter();

  // Panel toggle state (initial from SSR cookie, persisted on change)
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen ?? false);
  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      const next = !prev;
      document.cookie = `glow_panel=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });
  }, []);

  // Sidebar section change — navigate to artifact page
  const handleSectionChange = useCallback(
    (section: string) => {
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
    },
    [router],
  );

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
            <div className="flex min-h-svh w-full">
              <SidebarProvider defaultOpen={initialSidebarOpen ?? true}>
                <UnifiedSidebar
                  activeSection={sidebarProps.activeSection}
                  onSectionChange={handleSectionChange}
                  createFeedback={sidebarProps.createFeedback}
                />
                <SidebarInset>
                  <PageHeader
                    breadcrumbs={breadcrumbs}
                    toolbar={toolbar}
                    onTogglePanel={panelProps ? togglePanel : undefined}
                  />
                  <div className="flex flex-1 flex-col gap-4">{children}</div>
                </SidebarInset>
              </SidebarProvider>
              {panelProps && (
                <GenerationPanel
                  panelOpen={panelOpen}
                  onToggle={togglePanel}
                  artifactType={panelProps.artifactType}
                  groupId={panelProps.groupId}
                  generateAction={panelProps.generateAction}
                  permissions={panelProps.permissions}
                  getGroupHistory={panelProps.getGroupHistory}
                  searchGroups={panelProps.searchGroups}
                />
              )}
            </div>
          </GroupProviderClient>
        </ProfileProviderClient>
      </SocketProviderClient>
    </>
  );
}
