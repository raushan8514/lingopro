"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  CalendarClock,
  CreditCard,
  Goal,
  LayoutDashboard,
  ChartNoAxesColumn,
  GraduationCap,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  UsersRound,
  Video,
  Menu,
  Settings,
  ReceiptText,
  UserRound,
  X,
  Sparkles,
} from "lucide-react";
import AccountMenu from "@/components/auth/account-menu";
import BrandMark from "@/components/shared/brand-mark";
import { Avatar } from "@/components/ui/indicators";
import ThemeSwitcher from "@/components/ui/theme-switcher";
import LiveNotificationSync from "@/components/notifications/live-notification-sync";

const studentNavigation = [
  { href: "/student", label: "Overview", Icon: LayoutDashboard },
  { href: "/student/courses", label: "My courses", Icon: BookOpen },
  { href: "/student/subscription", label: "Subscription", Icon: CreditCard },
  { href: "/student/transactions", label: "Transactions", Icon: ReceiptText },
  { href: "/student/assessments", label: "Assessments", Icon: ClipboardCheck },
  { href: "/student/live-classes", label: "Live classes", Icon: Video },
  { href: "/student/ai-tutor", label: "AI tutor", Icon: Sparkles },
  { href: "/student/progress", label: "Progress", Icon: CircleGauge },
  { href: "/student/achievements", label: "Achievements", Icon: Award },
  { href: "/student/activity", label: "Learning activity", Icon: Activity },
  { href: "/student/goals", label: "Goals", Icon: Goal },
  { href: "/student/notifications", label: "Notifications", Icon: Bell },
  { href: "/student/profile", label: "Profile", Icon: UserRound },
  { href: "/student/settings", label: "Settings", Icon: Settings },
];

const instructorNavigation = [
  { href: "/instructor", label: "Overview", Icon: LayoutDashboard },
  { href: "/instructor/courses", label: "My courses", Icon: BookOpen },
  { href: "/instructor/assessments", label: "Assessments", Icon: ClipboardCheck },
  { href: "/instructor/live-classes", label: "Live classes", Icon: Video },
  { href: "/instructor/notifications", label: "Notifications", Icon: Bell },
  { href: "/instructor/profile", label: "Profile", Icon: UserRound },
  { href: "/instructor/settings", label: "Settings", Icon: Settings },
];

const adminNavigation = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", Icon: UsersRound },
  { href: "/admin/instructors", label: "Instructors", Icon: GraduationCap },
  { href: "/admin/courses", label: "Courses", Icon: BookOpen },
  { href: "/admin/categories", label: "Categories", Icon: Tags },
  { href: "/admin/assessments", label: "Assessments", Icon: ClipboardCheck },
  { href: "/admin/certificates", label: "Certificates", Icon: Award },
  { href: "/admin/live-classes", label: "Live classes", Icon: Video },
  { href: "/admin/notifications", label: "Notifications", Icon: Bell },
  { href: "/admin/payments", label: "Payments", Icon: ReceiptText },
  { href: "/admin/subscriptions", label: "Subscriptions", Icon: CalendarClock },
  { href: "/admin/reports", label: "Reports", Icon: ChartNoAxesColumn },
  { href: "/admin/activity", label: "Audit log", Icon: ScrollText },
  { href: "/admin/settings", label: "Settings", Icon: SlidersHorizontal },
  { href: "/admin/profile", label: "Profile", Icon: ShieldCheck },
];

function isActivePath(pathname, href, role) {
  const root = role === "admin"
    ? "/admin"
    : role === "instructor"
      ? "/instructor"
      : "/student";
  return href === root
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({ pathname, unreadCount, onNavigate, items, role }) {
  return (
    <nav
      className="student-sidebar-nav"
      id="student-sidebar-navigation"
      aria-label={`${role === "admin" ? "Administrator" : role === "instructor" ? "Instructor" : "Student"} navigation`}
    >
      {items.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href, role);
        return (
          <Link
            className={`student-nav-link${active ? " is-active" : ""}`}
            href={href}
            key={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            title={label}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
            {label === "Notifications" && unreadCount > 0 && (
              <span className="student-nav-count" aria-label={`${unreadCount} unread`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function StudentPortalShell({
  children,
  profile,
  unreadCount,
  role = "student",
  userId,
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const account = {
    fullName: profile.full_name,
    email: profile.email,
    role,
  };
  const isInstructor = role === "instructor";
  const isAdmin = role === "admin";
  const navigation = isAdmin
    ? adminNavigation
    : isInstructor
      ? instructorNavigation
      : studentNavigation;

  return (
    <div
      className={`student-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-nav-open" : ""}`}
    >
      <LiveNotificationSync userId={userId} />
      {mobileOpen && (
        <button
          className="student-nav-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className="student-sidebar"
        aria-label={`${isAdmin ? "Administrator" : isInstructor ? "Instructor" : "Student"} workspace`}
      >
        <div className="student-sidebar-brand">
          <BrandMark />
          <button
            className="student-sidebar-collapse"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          <button
            className="student-mobile-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <p className="student-sidebar-label">
          {isAdmin ? "PLATFORM ADMIN" : isInstructor ? "TEACHING SPACE" : "LEARNING SPACE"}
        </p>
        <NavigationLinks
          items={navigation}
          pathname={pathname}
          unreadCount={unreadCount}
          onNavigate={() => setMobileOpen(false)}
          role={role}
        />
        <div className="student-sidebar-bottom">
          <ThemeSwitcher className="student-sidebar-theme" />
          <div className="student-sidebar-account">
            <Avatar
              name={profile.full_name}
              src={profile.avatar_url}
              size="sm"
            />
            <div className="student-sidebar-account-copy">
              <strong>{profile.full_name}</strong>
              <span>{isAdmin ? "Administrator account" : isInstructor ? "Instructor account" : "Student account"}</span>
            </div>
            <AccountMenu account={account} />
          </div>
        </div>
      </aside>

      <div className="student-workspace">
        <header className="student-topbar">
          <div className="student-topbar-leading">
            <button
              className="student-mobile-menu"
              type="button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              aria-controls="student-sidebar-navigation"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="student-topbar-context">
              {isAdmin ? "Administrator workspace" : isInstructor ? "Instructor workspace" : "Student workspace"}
            </span>
          </div>
          <div className="student-topbar-actions">
            <ThemeSwitcher className="student-topbar-theme" />
            {!isInstructor && !isAdmin && <Link
              className="student-topbar-notifications"
              href="/student/notifications"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
            >
              <Bell size={19} strokeWidth={1.8} aria-hidden="true" />
              {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </Link>}
            <AccountMenu account={account} />
          </div>
        </header>
        <main className="student-main" id="student-main">
          {children}
        </main>
      </div>
    </div>
  );
}
