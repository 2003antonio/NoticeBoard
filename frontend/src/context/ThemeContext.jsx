import { createContext, useCallback, useContext, useEffect, useState } from "react";

// The theme is applied to <html data-theme> by a tiny inline script in
// index.html before first paint (so there is no flash). This context just
// mirrors that choice in React and lets the toggle flip it, persisting to
// localStorage so the browser remembers next time.
const ThemeContext = createContext(null);
const STORAGE_KEY = "nbt_theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(currentTheme);

  // Keep the <html> attribute and storage in sync whenever the theme changes.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode / blocked storage: the choice just won't persist */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
