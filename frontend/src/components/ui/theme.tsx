"use client";

import * as React from "react";

/**
 * Light and dark, chosen by the user or followed from their system.
 *
 * This is deliberately local rather than a library. The palette only needs a
 * class on the root element and a remembered preference, and the libraries
 * that do this render their anti-flash script from inside a client component,
 * which React 19 refuses to execute and then regenerates the whole tree over.
 * The script here is rendered by the server layout into the document head
 * instead, where it runs before first paint and never enters the React tree.
 */

export type Theme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

export const THEME_STORAGE_KEY = "pp360_theme";

/**
 * Runs before the first paint, so the page is never briefly the wrong colour.
 * Kept in one string because it is used verbatim in a script tag; it must not
 * reference anything outside itself.
 */
export const THEME_SCRIPT = `(function(){try{
var s=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';
var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.classList.toggle('dark',d);r.classList.toggle('light',!d);
r.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;

type ThemeContextValue = {
  /** What the user chose, which may be "system". */
  theme: Theme;
  /** What that currently means, once the system preference is read. */
  resolvedTheme: Resolved;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/** Matches the shape the vendored components already expect. */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  // A component used outside the provider — on the styleguide in isolation,
  // say — should still render rather than throw.
  return (
    context ?? {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    }
  );
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function apply(theme: Theme): Resolved {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The server cannot know the preference, so it renders the light default and
  // the head script corrects it before paint. State starts from what that
  // script already decided.
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [resolvedTheme, setResolved] = React.useState<Resolved>("light");

  React.useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      } catch {
        return null;
      }
    })();
    const initial = stored ?? "system";
    setThemeState(initial);
    setResolved(apply(initial));
  }, []);

  // Following the system means following it as it changes, not only at load.
  React.useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    setResolved(apply(next));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // A browser refusing storage still gets the theme for this visit.
    }
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
