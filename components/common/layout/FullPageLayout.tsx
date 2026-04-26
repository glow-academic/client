/**
 * FullPageLayout — general-purpose page layout with left sidebar, header, and right panel.
 *
 * Each artifact page renders this directly from page.tsx (server component) with
 * artifact-specific props. Replaces the layout-level sidebar/panel rendering.
 *
 * Interface: sidebarProps (left), breadcrumbs+toolbar (middle header), panelProps (right), children (content).
 *
 * Sidebar provider composition:
 *   <SidebarProvider> (LEFT)
 *     <UnifiedSidebar />
 *     <SidebarInset>
 *       <SidebarProvider> (RIGHT, nested — gives PageHeader's toggle access via useSidebar())
 *         <SidebarInset>
 *           <PageHeader ... />  ← inner provider context = right panel
 *           {children}
 *         </SidebarInset>
 *         {panelProps && <GenerationPanel />}
 *       </SidebarProvider>
 *     </SidebarInset>
 *   </SidebarProvider>
 *
 * The left trigger lives in PageHeader (inside the right provider's tree) so we
 * bridge the LEFT context across via a small render-prop component below.
 */
"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsNarrow } from "@/hooks/use-mobile";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { PageHeader, type BreadcrumbItem } from "@/components/common/layout/PageHeader";
import { GenerationPanel } from "@/components/common/ai/GenerationPanel";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { ProfileProviderClient } from "@/contexts/profile-context";
import type { ContextProfile } from "@/contexts/profile-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import { GroupProviderClient } from "@/contexts/group-context";
import { TransportProvider } from "@/lib/transport";
import type { TransportMode } from "@/lib/transport";
import { SIDEBAR_SECTIONS } from "@/lib/sidebar-config";

import type { SafeSessionSnapshot } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
  activeSection: string;
  createFeedback: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface PanelProps {
  /** Artifact type — used for both event namespacing and route prefix (e.g. "persona" → /persona/*) */
  artifactType: string;
  groupId: string | null;
  operations: string[];
  prompts?: Record<string, Array<{ title: string; content: string }>>;
}

export interface FullPageLayoutProps {
  // Auth/providers
  profileData: ContextProfile | null;
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
  // Transport mode override (default: auto-detect)
  transportMode?: TransportMode;
  // Content
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Left context bridge
// ---------------------------------------------------------------------------

// Captures the LEFT SidebarProvider context (it's the closest at this mount
// point) and exposes its toggleSidebar via render prop, so children mounted
// further down (inside the RIGHT provider) can still trigger the left side.
function LeftSidebarBridge({
  children,
}: {
  children: (ctx: { toggleSidebar: () => void }) => React.ReactNode;
}) {
  const { toggleSidebar } = useSidebar();
  return <>{children({ toggleSidebar })}</>;
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
  transportMode,
  children,
}: FullPageLayoutProps) {
  const router = useRouter();
  // When the viewport is narrow (e.g. ≤ 1280px), the right AI panel renders as
  // an overlay drawer instead of taking layout space. Left navigation keeps its
  // own mobile threshold (768px).
  const rightPanelIsMobile = useIsNarrow();

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
        <TransportProvider
          mode={transportMode}
          authToken={sessionSnapshot?.idToken}
        >
          <ProfileProviderClient
            initial={profileData}
            sessionSnapshot={sessionSnapshot}
          >
            <GroupProviderClient initialGroupId={profileData?.group_id ?? null}>
              <SidebarProvider defaultOpen={initialSidebarOpen ?? true}>
                <UnifiedSidebar
                  activeSection={sidebarProps.activeSection}
                  onSectionChange={handleSectionChange}
                  createFeedback={sidebarProps.createFeedback}
                />
                <SidebarInset>
                  <LeftSidebarBridge>
                    {({ toggleSidebar: toggleLeftSidebar }) => (
                      <SidebarProvider
                        defaultOpen={initialPanelOpen ?? false}
                        cookieName="glow_panel"
                        isMobile={rightPanelIsMobile}
                        className="!min-h-0"
                        style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
                      >
                        <SidebarInset>
                          <PageHeader
                            breadcrumbs={breadcrumbs}
                            toolbar={toolbar}
                            onToggleLeftSidebar={toggleLeftSidebar}
                            hasPanel={!!panelProps}
                          />
                          <div className="flex flex-1 flex-col gap-4">{children}</div>
                        </SidebarInset>
                        {panelProps && (
                          <GenerationPanel
                            artifactType={panelProps.artifactType}
                            groupId={panelProps.groupId}
                            operations={panelProps.operations}
                            prompts={panelProps.prompts}
                          />
                        )}
                      </SidebarProvider>
                    )}
                  </LeftSidebarBridge>
                </SidebarInset>
              </SidebarProvider>
            </GroupProviderClient>
          </ProfileProviderClient>
        </TransportProvider>
      </SocketProviderClient>
    </>
  );
}
