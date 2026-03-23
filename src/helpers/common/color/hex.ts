/**
 * Expands a 3-digit hex color to a 6-digit hex color, stripping any alpha channel.
 * @param hex - The hex color to expand (#rgb, #rgba, #rrggbb, or #rrggbbaa).
 * @returns The 6-digit hex color without '#'.
 * @throws If the hex color is invalid.
 */
export const expandHex = (hex: string): string => {
  const h = hex.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (/^[0-9a-fA-F]{4}$/.test(h)) {
    return `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) {
    return h;
  }
  if (/^[0-9a-fA-F]{8}$/.test(h)) {
    return h.substring(0, 6);
  }
  throw new Error(`Invalid hex color: ${hex}`);
};

/**
 * Blends two hex colors. c1 is placed over c2, blend is c1's opacity.
 * @param c1 - The first hex color.
 * @param c2 - The second hex color.
 * @param blend - The blend percentage (0-100).
 * @returns The blended hex color.
 */
export const hexBlend = (c1: string, c2: string, blend = 50): string => {
  c1 = expandHex(c1);
  c2 = expandHex(c2);
  let color = "";
  for (let i = 0; i <= 5; i += 2) {
    const h1 = parseInt(c1.substring(i, i + 2), 16);
    const h2 = parseInt(c2.substring(i, i + 2), 16);
    const hex = Math.floor(h2 + (h1 - h2) * (blend / 100))
      .toString(16)
      .padStart(2, "0");
    color += hex;
  }
  return `#${color}`;
};