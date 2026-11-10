"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";

const modes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Laptop },
];

export default function ThemeSwitcher({ className = "" }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`theme-switcher ${className}`.trim()}
      role="group"
      aria-label="Color theme"
    >
      {modes.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-switcher-option"
          aria-pressed={theme === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => setTheme(value)}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
