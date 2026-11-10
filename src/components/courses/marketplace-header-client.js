"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, Search, X } from "lucide-react";
import AccountMenu from "@/components/auth/account-menu";
import ThemeSwitcher from "@/components/ui/theme-switcher";
import ActionLink from "@/components/landing/action-link";

const links = [
  { href: "/courses", label: "Explore courses" },
  { href: "/categories", label: "Languages & topics" },
];

export default function MarketplaceHeaderClient({
  brand,
  account,
  authStatus,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <a className="market-skip-link" href="#main-content">Skip to content</a>
      <header className="market-header">
        <div className="market-header-inner">
          {brand}
          <nav className="market-header-nav" aria-label="Course marketplace">
            {links.map((link) => (
              <Link href={link.href} key={link.href}>{link.label}</Link>
            ))}
          </nav>
          <div className="market-header-actions">
            <Link className="market-header-search" href="/courses#course-search">
              <Search size={16} aria-hidden="true" />
              <span>Search courses</span>
              <kbd>/</kbd>
            </Link>
            <ThemeSwitcher className="market-header-theme" />
            {account ? (
              <AccountMenu account={account} />
            ) : (
              <div className="market-header-auth">
                <Link href="/login">Log in</Link>
                <ActionLink
                  href="/register"
                  size="sm"
                  rightIcon={<ArrowRight size={15} aria-hidden="true" />}
                >
                  Get started
                </ActionLink>
              </div>
            )}
          </div>
          <button
            className="market-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="market-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="market-mobile-nav" id="market-mobile-navigation">
            <nav aria-label="Mobile course marketplace">
              {links.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/courses#course-search"
                onClick={() => setMenuOpen(false)}
              >
                <Search size={16} aria-hidden="true" />
                Search courses
              </Link>
            </nav>
            <div className="market-mobile-nav-actions">
              <ThemeSwitcher />
              {account ? (
                <AccountMenu account={account} />
              ) : (
                <div className="market-mobile-auth">
                  <Link href="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
                  <ActionLink
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                  >
                    Create a student account
                  </ActionLink>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      {["unavailable", "profile-unavailable"].includes(authStatus) && (
        <p className="market-auth-note" role="status">
          Account details are unavailable right now. You can still browse published courses.
        </p>
      )}
    </>
  );
}
