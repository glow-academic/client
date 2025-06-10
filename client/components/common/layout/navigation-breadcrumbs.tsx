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

interface NavigationBreadcrumbsProps {
  breadcrumbs: Array<{ title: string; section?: string }>;
  onSectionChange?: (section: string) => void;
  rightContent?: React.ReactNode;
}

export function NavigationBreadcrumbs({
  breadcrumbs,
  onSectionChange,
  rightContent,
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

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return rightContent ? (
      <div className="flex items-center justify-between w-full">
        <div />
        {rightContent}
      </div>
    ) : null;
  }

  return (
    <div className="flex items-center justify-between w-full">
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
      {rightContent && <div className="ml-4">{rightContent}</div>}
    </div>
  );
}
