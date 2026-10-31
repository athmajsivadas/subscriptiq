import { useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { CSVUploader } from "@/components/CSVUploader";
import { LayoutDashboard, TrendingUp, Receipt, CircleDollarSign, FileText, Zap, Activity, Upload, Building2, CreditCard, Settings } from "@/components/icons";
import { StackedDatabaseIcon } from "@/components/icons";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const mainNavItems = [{
  title: "Overview",
  url: "/",
  icon: LayoutDashboard
}, {
  title: "Revenue",
  url: "/revenue",
  icon: TrendingUp
}, {
  title: "Expenses",
  url: "/expenses",
  icon: Receipt
}, {
  title: "Profitability",
  url: "/profitability",
  icon: CircleDollarSign
}, {
  title: "Cash Flow",
  url: "/cash-flow",
  icon: Activity
}, {
  title: "Receivable & Payable",
  url: "/receivables",
  icon: CreditCard
}, {
  title: "Reports & Export",
  url: "/reports",
  icon: FileText
}];
const connectItems = [{
  title: "Upload CSV",
  icon: Upload
}, {
  title: "QuickBooks",
  icon: Building2
}, {
  title: "Stripe",
  icon: CreditCard
}, {
  title: "HubSpot",
  icon: Settings
}];
export function FinancialSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const [csvUploaderOpen, setCsvUploaderOpen] = useState(false);
  const collapsed = state === "collapsed";
  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };
  const getNavClasses = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active ? "bg-primary-light text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`;
  };
  const getIconClasses = (path: string) => {
    const active = isActive(path);
    const size = "w-5 h-5";
    return `${size} flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`;
  };
  return <Sidebar className={`${collapsed ? "w-16" : "w-64"} border-r border-sidebar-border bg-sidebar transition-all duration-300`}>
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <div>
              <h2 className="text-sidebar-foreground">FinanceFlow</h2>
              <p className="text-xs text-muted-foreground">Financial Dashboard</p>
            </div>}
        </div>
      </div>

      <SidebarContent className="px-4 py-6">
        <SidebarGroup>
          <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground mb-3 ${collapsed ? "hidden" : ""}`}>
            MAIN NAVIGATION
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClasses(item.url)}>
                      <item.icon className={getIconClasses(item.url)} />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground mb-3 ${collapsed ? "hidden" : ""}`}>
            CONNECT DATA
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!collapsed && <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-left h-auto py-2" onClick={() => setShowConnectOptions(!showConnectOptions)}>
                  <StackedDatabaseIcon size="sm" className="mr-1" />
                  Connect Data Sources
                </Button>
                
                {showConnectOptions && <div className="ml-6 space-y-1 border-l border-sidebar-border pl-4">
                    {connectItems.map(item => <Button key={item.title} variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground" onClick={() => item.title === "Upload CSV" && setCsvUploaderOpen(true)} disabled={item.title !== "Upload CSV"}>
                        <StackedDatabaseIcon size="sm" className="" />
                        <span className="flex-1 text-left">{item.title}</span>
                        {item.title !== "Upload CSV" && <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-2 h-3.5 align-super">Soon</Badge>}
                      </Button>)}
                  </div>}
                <CSVUploader open={csvUploaderOpen} onOpenChange={setCsvUploaderOpen} />
              </div>}
            {collapsed && <Button variant="ghost" size="sm" className="w-full p-2" onClick={() => setShowConnectOptions(!showConnectOptions)}>
                <StackedDatabaseIcon size="md" />
              </Button>}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}