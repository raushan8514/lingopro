"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/auth/actions";
import { roleHomePaths } from "@/lib/auth/paths";

const roleLabels = {
  student: "Student",
  instructor: "Instructor",
  admin: "Admin",
};

export default function AccountMenu({ account }) {
  const [logoutError, setLogoutError] = useState("");
  const [pending, startTransition] = useTransition();
  const destination = roleHomePaths[account.role];
  const displayName = account.fullName || account.email || "Account";

  const items = [
    {
      label: `Open ${roleLabels[account.role] || "account"} portal`,
      icon: ArrowUpRight,
      disabled: !destination,
      onSelect: () => {
        if (destination) window.location.assign(destination);
      },
    },
    { separator: true },
    {
      label: pending ? "Signing out…" : "Sign out",
      icon: LogOut,
      destructive: true,
      disabled: pending,
      onSelect: () => {
        setLogoutError("");
        startTransition(async () => {
          const result = await logoutAction();
          if (result?.error) setLogoutError(result.error);
        });
      },
    },
  ];

  return (
    <div className="landing-account-menu">
      <DropdownMenu
        label="Open account menu"
        align="end"
        trigger={
          <span className="landing-account-trigger">
            <span className="landing-account-avatar" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="landing-account-name">{displayName}</span>
          </span>
        }
        items={items}
      />
      {logoutError && <span className="landing-logout-error" role="alert">{logoutError}</span>}
    </div>
  );
}
