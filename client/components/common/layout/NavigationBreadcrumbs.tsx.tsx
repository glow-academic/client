import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { createBreadcrumbSectionChangeHandler } from "@/utils/navigation-utils";

export interface NavigationBreadcrumbsProps {
  breadcrumbs: Array<{ title: string; section?: string }>;
  onSectionChange?: (section: string) => void;
}

export function NavigationBreadcrumbs({
  breadcrumbs,
  onSectionChange,
}: NavigationBreadcrumbsProps) {
  const router = useRouter();
  const breadcrumbNavigate = createBreadcrumbSectionChangeHandler(router);

  const handleBreadcrumbClick = (crumb: {
    title: string;
    section?: string;
  }) => {
    if (crumb.section) {
      if (onSectionChange) {
        // If we have an onSectionChange prop, use it (for layout components)
        onSectionChange(crumb.section);
      } else {
        // Otherwise, handle navigation directly with breadcrumb-specific logic
        breadcrumbNavigate(crumb.section);
      }
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
