"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import BrandMark from "@/components/shared/brand-mark";
import ThemeSwitcher from "@/components/ui/theme-switcher";
import ActionLink from "@/components/landing/action-link";
import AccountMenu from "@/components/auth/account-menu";
import { navigationItems } from "@/lib/landing-content";

export default function SiteHeaderClient({ account, authStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <a className="landing-skip-link" href="#main-content">Skip to content</a>
      <header className="landing-header">
        <div className="landing-header-inner">
          <BrandMark />
          <nav className="landing-desktop-nav" aria-label="Main navigation">
            {navigationItems.map((item) => (
              <a className="landing-nav-link" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="landing-header-actions">
            <ThemeSwitcher className="landing-header-theme" />
            {account ? (
              <AccountMenu account={account} />
            ) : (
              <div className="landing-account-actions">
                <a className="landing-login-link" href="/login">Log in</a>
                <ActionLink
                  href="/register"
                  size="sm"
                  rightIcon={<ArrowRight size={15} aria-hidden="true" />}
                  className="landing-header-cta"
                >
                  Create account
                </ActionLink>
              </div>
            )}
          </div>
          <button
            ref={menuButtonRef}
            className="landing-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <div
          className={`landing-mobile-nav${menuOpen ? " is-open" : ""}`}
          id="mobile-navigation"
          hidden={!menuOpen}
        >
          <nav aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              <a href={item.href} key={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="landing-mobile-actions">
            <ThemeSwitcher />
            {account ? (
              <AccountMenu account={account} />
            ) : (
              <div className="landing-mobile-account-actions">
                <a href="/login" onClick={closeMenu}>Log in</a>
                <ActionLink
                  href="/register"
                  onClick={closeMenu}
                  rightIcon={<ArrowRight size={15} />}
                >
                  Create account
                </ActionLink>
              </div>
            )}
          </div>
        </div>
      </header>
      {authStatus === "unavailable" && (
        <p className="landing-auth-status" role="status">
          Account status is temporarily unavailable. The public site is still available.
        </p>
      )}
      {authStatus === "profile-unavailable" && (
        <p className="landing-auth-status" role="status">
          We couldn&apos;t load your account profile. Protected areas remain unavailable.
        </p>
      )}
    </>
  );
}
