"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! h-10 w-10 justify-center"
              render={<a href="#" />}
              tooltip="Netbot"
            >
              <CommandIcon className="size-5!" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.isActive}
                    render={<a href={item.url} />}
                    className="h-10 w-10 justify-center rounded-md transition-colors hover:bg-accent/50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&>svg]:size-6 [&>svg]:stroke-[1.5]"
                  >
                    {item.icon}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<a href={item.url} />}
                    tooltip={item.title}
                    className="h-10 w-10 justify-center rounded-md transition-colors hover:bg-accent/50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground [&>svg]:size-6 [&>svg]:stroke-[1.5]"
                  >
                    {item.icon}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}