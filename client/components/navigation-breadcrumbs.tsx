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
}

export function NavigationBreadcrumbs({ breadcrumbs, onSectionChange }: NavigationBreadcrumbsProps) {
  const handleBreadcrumbClick = (section?: string) => {
    if (section && onSectionChange) {
      onSectionChange(section);
    }
  };

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  return (
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
  )
} 