export function normalizeThemeName(theme?: string): string | undefined {
  if (typeof theme !== "string") return undefined;
  const trimmed = theme.trim();
  return trimmed.length ? trimmed : undefined;
}
