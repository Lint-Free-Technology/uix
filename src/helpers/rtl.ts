type Translation = {
  isRTL?: boolean;
};

/** Returns whether Home Assistant has marked the active language as right-to-left. */
export function computeRtl(
  language = "en",
  translations: Record<string, Translation> = {},
): boolean {
  return translations[language]?.isRTL || false;
}
