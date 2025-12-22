/**
 * Sidebar Navigation Component
 * Based on shadcn/ui patterns
 * Writer.com aesthetic
 */

import React, { useState } from "react";
import {
  BarChart3,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus,
  Clock,
  Archive,
} from "lucide-react";
import { Button, Card, colors, Typography } from "./ui";

// ============================================
// TYPES
// ============================================

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  active?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  sections: NavSection[];
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
}

// ============================================
// SIDEBAR COMPONENT
// ============================================

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ sections, user, onLogout }, ref) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
      <div
        ref={ref}
        className={`${
          isExpanded ? "w-64" : "w-20"
        } h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          {isExpanded && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-slate-900">
                CRM
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              {isExpanded && (
                <h3 className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${colors.text.muted}`}>
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item, idx) => (
                  <NavButton
                    key={idx}
                    item={item}
                    isExpanded={isExpanded}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User Profile */}
        {user && (
          <div className={`border-t border-slate-200 p-3 space-y-3`}>
            <div className={`flex items-center gap-3 ${!isExpanded && "justify-center"}`}>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="rounded-full" />
                ) : (
                  user.name[0]
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-900">
                    {user.name}
                  </p>
                  <p className={`text-xs truncate ${colors.text.muted}`}>
                    {user.email}
                  </p>
                </div>
              )}
            </div>
            {isExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-full justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);
Sidebar.displayName = "Sidebar";

// ============================================
// NAV BUTTON COMPONENT
// ============================================

interface NavButtonProps {
  item: NavItem;
  isExpanded: boolean;
}

const NavButton = ({ item, isExpanded }: NavButtonProps) => {
  const [showSubmenu, setShowSubmenu] = useState(false);

  return (
    <div>
      <button
        onClick={() => {
          item.onClick?.();
          setShowSubmenu(!showSubmenu);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          item.active
            ? "bg-blue-50 text-blue-600"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {isExpanded && (
          <>
            <span className="flex-1 text-left text-sm">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                {item.badge}
              </span>
            )}
            {item.onClick && <ChevronDown className="h-4 w-4" />}
          </>
        )}
      </button>
    </div>
  );
};

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

interface MainLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  showSidebar?: boolean;
}

export const MainLayout = ({ children, sidebar, showSidebar = true }: MainLayoutProps) => {
  return (
    <div className="flex h-screen bg-white">
      {showSidebar && sidebar}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};

// ============================================
// HEADER COMPONENT
// ============================================

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const Header = ({ title, subtitle, actions, breadcrumbs }: HeaderProps) => (
  <div className={`border-b ${colors.border} bg-slate-50 px-6 py-4`}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <div className={`flex items-center gap-2 mb-3 text-sm ${colors.text.muted}`}>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span>/</span>}
            <span>{crumb.label}</span>
          </React.Fragment>
        ))}
      </div>
    )}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>{title}</h1>
        {subtitle && <p className={`text-sm mt-1 ${colors.text.secondary}`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </div>
);

// ============================================
// CONTENT AREA COMPONENT
// ============================================

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

export const Content = ({ children, className }: ContentProps) => (
  <div className={`flex-1 overflow-y-auto px-6 py-6 ${className}`}>
    {children}
  </div>
);

// ============================================
// STATS GRID
// ============================================

interface Stat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  color?: "blue" | "green" | "amber" | "red";
}

export const StatsGrid = ({ stats }: { stats: Stat[] }) => {
  const colorMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <Card key={idx} variant="outlined" className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium ${colors.text.muted} mb-1`}>
                {stat.label}
              </p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {stat.value}
              </p>
              {stat.trend !== undefined && (
                <p
                  className={`text-xs mt-2 ${
                    stat.trend > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {stat.trend > 0 ? "↑" : "↓"} {Math.abs(stat.trend)}% vs last period
                </p>
              )}
            </div>
            {stat.icon && (
              <div className={`${colorMap[stat.color || "blue"]} opacity-20`}>
                {stat.icon}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

// ============================================
// DEFAULT NAVIGATION STRUCTURE
// ============================================

export const getDefaultNavigation = (): NavSection[] => [
  {
    title: "Main",
    items: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-5 w-5" />,
        href: "/",
        active: true,
      },
      {
        label: "Conversations",
        icon: <MessageSquare className="h-5 w-5" />,
        href: "/conversations",
        badge: 3,
      },
      {
        label: "Contacts",
        icon: <Users className="h-5 w-5" />,
        href: "/contacts",
      },
    ],
  },
  {
    title: "Organization",
    items: [
      {
        label: "Recent",
        icon: <Clock className="h-5 w-5" />,
      },
      {
        label: "Archived",
        icon: <Archive className="h-5 w-5" />,
      },
      {
        label: "Settings",
        icon: <Settings className="h-5 w-5" />,
      },
    ],
  },
];
