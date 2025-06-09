import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface NavigationBreadcrumbsProps {
  breadcrumbs: Array<{ title: string; section?: string }>
  onSectionChange?: (section: string) => void
  rightContent?: React.ReactNode
}

export function NavigationBreadcrumbs({ breadcrumbs, onSectionChange, rightContent }: NavigationBreadcrumbsProps) {
  const handleBreadcrumbClick = (section?: string) => {
    if (section && onSectionChange) {
      onSectionChange(section);
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
                    onClick={() => handleBreadcrumbClick(crumb.section)}
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
      {rightContent && (
        <div className="ml-4">
          {rightContent}
        </div>
      )}
    </div>
  )
} 