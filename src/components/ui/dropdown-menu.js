"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DropdownMenu({
  trigger,
  items,
  label = "Open menu",
  align = "start",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    rootRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event) {
    const menuItems = Array.from(
      event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)'),
    );
    const index = menuItems.indexOf(document.activeElement);

    if (!menuItems.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + direction + menuItems.length) % menuItems.length;
      menuItems[next]?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      menuItems[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      menuItems.at(-1)?.focus();
    }
  }

  return (
    <div className="ui-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        className="ui-dropdown-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={cn("ui-dropdown-menu", `ui-dropdown-${align}`)}
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return <div key={`separator-${index}`} className="ui-dropdown-separator" />;
            }

            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cn(
                  "ui-dropdown-item",
                  item.destructive && "ui-dropdown-item-destructive",
                )}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  closeMenu(true);
                }}
              >
                {Icon && <Icon size={16} aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
