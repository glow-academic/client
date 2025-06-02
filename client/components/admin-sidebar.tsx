import * as React from "react"
import { ChevronRight, Home, BookOpen, FileText, HelpCircle, GraduationCap, MessageSquare, Settings } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { getClasses } from "@/utils/queries/get-classes"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function AdminSidebar({ activeSection, onSectionChange, ...props }: AdminSidebarProps) {
  // Fetch classes for dynamic menu
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  })

  const navMain = [
    {
      title: "Dashboard",
      url: "#",
      icon: Home,
      items: [
        {
          title: "Home",
          url: "#",
          section: "home",
        },
        {
          title: "History",
          url: "#",
          section: "history",
        },
      ],
    },
    {
      title: "Classes",
      url: "#",
      icon: GraduationCap,
      items: classes.map((cls: any) => ({
        title: cls.classCode,
        url: "#",
        section: `class-${cls.id}`,
        classData: cls,
      })),
    },
    {
      title: "Quizzes",
      url: "#",
      icon: HelpCircle,
      items: [
        {
          title: "View Quizzes",
          url: "#",
          section: "quiz-list",
        },
        {
          title: "Create Quiz",
          url: "#",
          section: "quiz-create",
        },
      ],
    },
    {
      title: "Chats",
      url: "#",
      icon: MessageSquare,
      items: [
        {
          title: "Profiles",
          url: "#",
          section: "chat-profiles",
        },
        {
          title: "Scenarios",
          url: "#",
          section: "chat-scenarios",
        },
      ],
    },
    {
      title: "Management",
      url: "#",
      icon: Settings,
      items: [
        {
          title: "Students",
          url: "#",
          section: "student-management",
        },
      ],
    },
  ]

  const handleItemClick = (item: any) => {
    if (item.section) {
      onSectionChange(item.section)
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <BookOpen className="h-6 w-6" />
          <span className="font-semibold text-lg">GLOW</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {navMain.map((item) => (
          <Collapsible
            key={item.title}
            title={item.title}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.title}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items?.map((subItem) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton 
                          isActive={activeSection === subItem.section}
                          onClick={() => handleItemClick(subItem)}
                          className={(subItem as any).isSubItem ? "pl-8 text-sm" : ""}
                        >
                          {(subItem as any).isSubItem && <FileText className="h-3 w-3 mr-2" />}
                          {subItem.title}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
} 