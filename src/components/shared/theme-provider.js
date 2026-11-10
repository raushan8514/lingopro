"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "lingopro-theme";
const ThemeContext = createContext(null);
let inMemoryTheme = null;

function getThemeSnapshot() {
  if (inMemoryTheme !== null) return inMemoryTheme;

  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (["light", "dark", "system"].includes(storedTheme)) return storedTheme;
  } catch (error) {
    console.error("Unable to read the saved LingoPro theme preference.", error);
  }

  return "system";
}

function getServerThemeSnapshot() {
  return "system";
}

function subscribeToTheme(callback) {
  function handleStorageChange() {
    inMemoryTheme = null;
    applyTheme(getThemeSnapshot());
    callback();
  }

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("lingopro-theme-change", callback);
  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener("lingopro-theme-change", callback);
  };
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.dataset.theme = theme;
  }
  if (theme === "system") {
    root.style.removeProperty("color-scheme");
  } else {
    root.style.colorScheme = theme;
  }
}

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (theme === "system") applyTheme("system");
    };

    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!["light", "dark", "system"].includes(nextTheme)) {
      throw new Error(`Unsupported theme: ${nextTheme}`);
    }

    inMemoryTheme = nextTheme;
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error("Unable to save the LingoPro theme preference.", error);
    }

    window.dispatchEvent(new Event("lingopro-theme-change"));
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
