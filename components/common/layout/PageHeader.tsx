/**
 * PageHeader — page-owned header with breadcrumbs and optional toolbar.
 *
 * Each page renders this with its own data instead of relying on a global
 * layout to infer breadcrumbs/toolbar from the pathname.
 */
"use client";

import { PanelRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGenerationPanelContext } from "@/contexts/generation-panel-context";
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
}

export function PageHeader({ breadcrumbs, toolbar }: PageHeaderProps) {
  const panelCtx = useGenerationPanelContext();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <NavigationBreadcrumbs breadcrumbs={breadcrumbs} />
      </div>
      {toolbar && <div className="flex items-center gap-2 pr-4">{toolbar}</div>}
      {panelCtx && (
        <div className="pr-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={panelCtx.togglePanel}
          >
            <PanelRightIcon />
            <span className="sr-only">Toggle AI Panel</span>
          </Button>
        </div>
      )}
    </header>
  );
}
