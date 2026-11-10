"use client";

import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext(null);

function getValueId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}) {
  const id = useId();
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  function setValue(nextValue) {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  }

  function handleKeyDown(event) {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)'),
    );
    const currentIndex = tabs.indexOf(document.activeElement);
    let nextIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  }

  return (
    <TabsContext.Provider value={{ id, value, setValue }}>
      <div className={cn("ui-tabs", className)} onKeyDown={handleKeyDown}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, label = "Options", className }) {
  return (
    <div className={cn("ui-tabs-list", className)} role="tablist" aria-label={label}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, disabled = false, className }) {
  const tabs = useContext(TabsContext);
  if (!tabs) throw new Error("TabsTrigger must be used within Tabs.");
  const selected = tabs.value === value;
  const valueId = getValueId(value);

  return (
    <button
      className={cn("ui-tab-trigger", selected && "ui-tab-trigger-active", className)}
      id={`${tabs.id}-tab-${valueId}`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`${tabs.id}-panel-${valueId}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => tabs.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const tabs = useContext(TabsContext);
  if (!tabs) throw new Error("TabsContent must be used within Tabs.");
  const valueId = getValueId(value);

  return (
    <div
      className={cn("ui-tab-panel", className)}
      id={`${tabs.id}-panel-${valueId}`}
      role="tabpanel"
      aria-labelledby={`${tabs.id}-tab-${valueId}`}
      tabIndex={0}
      hidden={tabs.value !== value}
    >
      {children}
    </div>
  );
}
