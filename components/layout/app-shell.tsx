"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CalendarDays,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
  Bell,
  Search,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/* ── Nav items ── */
const navItems = [
  { href: "dashboard",     label: "Dashboard",   icon: LayoutDashboard },
  { href: "leads",         label: "Leads",        icon: Users },
  { href: "conversations", label: "Conversations",icon: MessageSquare },
  { href: "bookings",      label: "Bookings",     icon: CalendarDays },
  { href: "payments",      label: "Payments",     icon: CreditCard },
  { href: "analytics",     label: "Analytics",    icon: BarChart3 },
] as const;

const bottomItems = [
  { href: "settings", label: "Settings", icon: Settings },
] as const;

/* ── Types ── */
interface AppShellProps {
  children: React.ReactNode;
  orgSlug: string;
  orgName?: string;
  user?: { name?: string; email?: string; avatarUrl?: string } | null;
  /** Override default title (shown in topbar) */
  pageTitle?: string;
}

/* ────────────────────────────────────────────
   APP SHELL
──────────────────────────────────────────── */
export function AppShell({
  children,
  orgSlug,
  orgName,
  user,
  pageTitle,
}: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const pathname = usePathname();

  const sidebarWidth = collapsed ? 64 : 220;

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)] overflow-hidden"
      >
        {/* Logo area */}
        <div className="flex h-14 items-center justify-between px-4 shrink-0">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="logo-expanded"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-2 min-w-0"
              >
                <Zap className="h-5 w-5 text-[var(--brand)] shrink-0" />
                <span className="font-display font-semibold text-sm text-[var(--text)] truncate">
                  {orgName ?? "CoachOS"}
                </span>
              </motion.div>
            )}
            {collapsed && (
              <motion.div
                key="logo-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="mx-auto"
              >
                <Zap className="h-5 w-5 text-[var(--brand)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors rounded p-0.5"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          {navItems.map((item) => {
            const href = `/org/${orgSlug}/${item.href}`;
            const active = pathname.startsWith(href);
            return (
              <NavItem
                key={item.href}
                href={href}
                label={item.label}
                icon={<item.icon className="h-4 w-4 shrink-0" />}
                active={active}
                collapsed={collapsed}
              />
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 space-y-0.5">
          <Separator className="mb-2" />
          {bottomItems.map((item) => {
            const href = `/org/${orgSlug}/${item.href}`;
            const active = pathname.startsWith(href);
            return (
              <NavItem
                key={item.href}
                href={href}
                label={item.label}
                icon={<item.icon className="h-4 w-4 shrink-0" />}
                active={active}
                collapsed={collapsed}
              />
            );
          })}

          {/* User chip */}
          <button
            className={cn(
              "w-full flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--bg-3)] mt-2",
              collapsed && "justify-center px-0"
            )}
          >
            <Avatar size="sm">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex flex-col items-start overflow-hidden min-w-0"
                >
                  <span className="text-xs font-medium text-[var(--text)] truncate max-w-[120px]">
                    {user?.name ?? user?.email ?? "User"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute bottom-[140px] -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] text-[var(--text-3)] hover:text-[var(--text)] shadow-card transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronLeft className="h-3 w-3 rotate-180" />
          </button>
        )}
      </motion.aside>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[220px] flex flex-col border-r border-[var(--border)] bg-[var(--bg-1)] md:hidden"
            >
              <div className="flex h-14 items-center gap-2 px-4">
                <Zap className="h-5 w-5 text-[var(--brand)]" />
                <span className="font-display font-semibold text-sm text-[var(--text)]">
                  {orgName ?? "CoachOS"}
                </span>
              </div>
              <Separator />
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {navItems.map((item) => {
                  const href = `/org/${orgSlug}/${item.href}`;
                  const active = pathname.startsWith(href);
                  return (
                    <NavItem
                      key={item.href}
                      href={href}
                      label={item.label}
                      icon={<item.icon className="h-4 w-4 shrink-0" />}
                      active={active}
                      collapsed={false}
                      onClick={() => setMobileSidebarOpen(false)}
                    />
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-1)] px-4">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {pageTitle && (
              <h1 className="font-display text-sm font-semibold text-[var(--text)]">
                {pageTitle}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="h-4 w-4 text-[var(--text-3)]" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4 text-[var(--text-3)]" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Nav Item ── */
function NavItem({
  href,
  label,
  icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors duration-[120ms]",
        active
          ? "bg-[var(--bg-3)] text-[var(--text)] font-medium"
          : "text-[var(--text-3)] hover:bg-[var(--bg-3)] hover:text-[var(--text-2)]",
        collapsed && "justify-center px-0 py-2"
      )}
    >
      <span className={cn(active && "text-[var(--brand)]")}>{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
