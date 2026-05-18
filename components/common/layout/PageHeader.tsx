/**
 * PageHeader — page-owned header with breadcrumbs and optional toolbar.
 *
 * Each page renders this with its own data instead of relying on a global
 * layout to infer breadcrumbs/toolbar from the pathname.
 *
 * Left-sidebar toggle is injected by FullPageLayout (since the left provider
 * lives outside this header's React tree). Right-panel toggle uses the
 * inner SidebarProvider's `useSidebar()` directly.
 */
"use client";

import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { NavigationBreadcrumbs } from "./NavigationBreadcrumbs";

export interface BreadcrumbItem {
  title: string;
  section?: string;
  url?: string;
}

export interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  /** Optional toolbar content rendered on the right side of the header */
  toolbar?: React.ReactNode;
  /** Toggle for the LEFT navigation sidebar — injected by FullPageLayout */
  onToggleLeftSidebar: () => void;
  /** When true, renders the right-panel toggle button. Toggle action comes from the inner SidebarProvider via useSidebar(). */
  hasPanel?: boolean;
}

export function PageHeader({ breadcrumbs, toolbar, onToggleLeftSidebar, hasPanel }: PageHeaderProps) {
  // useSidebar() resolves to the innermost provider — the RIGHT panel.
  // Calling toggleSidebar() correctly switches between desktop open/closed
  // and mobile sheet open/closed depending on viewport.
  const { toggleSidebar: toggleRightPanel } = useSidebar();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 -ml-1 shrink-0"
          onClick={onToggleLeftSidebar}
        >
          <PanelLeftIcon />
          <span className="sr-only">Toggle navigation</span>
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <NavigationBreadcrumbs breadcrumbs={breadcrumbs} />
        </div>
      </div>
      {toolbar && <div className="flex items-center gap-2 shrink-0">{toolbar}</div>}
      {hasPanel && (
        <div className="pr-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleRightPanel}
          >
            <PanelRightIcon />
            <span className="sr-only">Toggle AI Panel</span>
          </Button>
        </div>
      )}
    </header>
  );
}
