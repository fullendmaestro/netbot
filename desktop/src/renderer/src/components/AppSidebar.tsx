"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  Server,
  Network,
  TerminalSquare,
  Settings,
  CommandIcon
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Devices",
      url: "#",
      icon: <Server />,
      isActive: true,
    },
    {
      title: "Topology",
      url: "#",
      icon: <Network />,
    },
    {
      title: "Terminal",
      url: "#",
      icon: <TerminalSquare />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: <Settings />,
    },
  ],
}

export function AppSidebar({
  activeView,
  onViewChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView?: string
  onViewChange?: (view: string) => void
}) {
  return (
    <Sidebar collapsible="none" {...props} className="h-svh flex flex-col">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="justify-center mt-2"
              render={<a href="#" />}
              tooltip="Netbot"
            >
              <CommandIcon className="size-5!" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-3 mt-4">
              {data.navMain.map((item) => {
                const isActive = activeView === item.title;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      onClick={() => onViewChange?.(item.title)}
                      // Reduced icon size from size-6! to size-5!
                      className="justify-center rounded-md transition-colors hover:bg-accent/50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&>svg]:size-5! [&>svg]:stroke-[1.5]"
                    >
                      {item.icon}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto pb-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<a href={item.url} />}
                    tooltip={item.title}
                    // Reduced icon size from size-6! to size-5!
                    className="justify-center rounded-md transition-colors hover:bg-accent/50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&>svg]:size-5! [&>svg]:stroke-[1.5]"
                  >
                    {item.icon}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}