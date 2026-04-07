import { browser } from "$app/environment";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "yeet2-theme";

function readStoredTheme(): ThemeMode | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // localStorage unavailable (private mode, iframe sandbox, etc.)
  }
  return null;
}

function systemPreferredTheme(): ThemeMode {
  if (!browser) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function currentTheme(): ThemeMode {
  if (!browser) return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return readStoredTheme() ?? systemPreferredTheme();
}

export function setTheme(mode: ThemeMode): void {
  if (!browser) return;
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Fine — the attribute is set for this session even if we can't persist.
  }
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
