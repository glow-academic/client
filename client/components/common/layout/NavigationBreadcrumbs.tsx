import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface NavigationBreadcrumbsProps {
  breadcrumbs: Array<{ title: string; section?: string | null; url?: string }>;
  onSectionChange?: (section: string) => void;
}

export function NavigationBreadcrumbs({
  breadcrumbs,
  onSectionChange,
}: NavigationBreadcrumbsProps) {
  const router = useRouter();

  const handleBreadcrumbClick = (crumb: {
    title: string;
    section?: string | null;
    url?: string;
  }) => {
    // Prefer the server-provided URL (handles nested routes like /training/cohorts)
    if (crumb.url) {
      router.push(crumb.url);
      router.refresh();
    } else if (onSectionChange && crumb.section) {
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
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => handleBreadcrumbClick(crumb)}
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
