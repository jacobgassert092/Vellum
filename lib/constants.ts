export const THEMES = {
  dark: { bg: "#0b0b0e", fg: "#d1d5db", panel: "#141417" },
  light: { bg: "#ffffff", fg: "#1a1a1a", panel: "#f3f4f6" },
  sepia: { bg: "#f4ecd8", fg: "#5b4636", panel: "#e8dfc8" }
};

export const FONT_STACKS: Record<string, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  serif: "'Georgia', 'Times New Roman', serif",
  monospace: "'JetBrains Mono', 'Fira Code', monospace",
};

export const getFontStack = (key: string) => FONT_STACKS[key] || FONT_STACKS.helvetica;