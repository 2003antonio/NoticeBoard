import { Moon, Sun } from "lucide-react";

import { useTheme } from "../context/ThemeContext";

// Switches between light and dark. The icon shows the theme you'd switch TO,
// and the accessible label says the action.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const toDark = theme === "light";
  return (
    <button
      onClick={toggle}
      className="rounded-md border border-rule bg-surface p-2 text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={toDark ? "Switch to dark theme" : "Switch to light theme"}
      title={toDark ? "Dark theme" : "Light theme"}
    >
      {toDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
