import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import * as React from "react";

export interface NavigationBreadcrumbsProps {
  breadcrumbs: Array<{ title: string; section?: string | null; url?: string }>;
  onSectionChange?: (section: string) => void;
}

export function NavigationBreadcrumbs({
  breadcrumbs,
  onSectionChange,
}: NavigationBreadcrumbsProps) {
  const handleSectionClick = (crumb: {
    title: string;
    section?: string | null;
    url?: string;
  }) => {
    if (onSectionChange && crumb.section) {
      onSectionChange(crumb.section);
    }
  };

  return (
    <div className="flex items-center w-full">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                ) : crumb.url ? (
                  <BreadcrumbLink asChild>
                    <HoverPrefetchLink href={crumb.url} className="cursor-pointer">
                      {crumb.title}
                    </HoverPrefetchLink>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => handleSectionClick(crumb)}
                  >
                    {crumb.title}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
