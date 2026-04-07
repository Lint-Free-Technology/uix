import parse from "parse-duration";

/**
 * Parse a duration value into milliseconds.
 *
 * - Numbers are passed through unchanged (treated as milliseconds).
 * - Strings are parsed with the `parse-duration` library, which understands
 *   human-friendly units such as `"5s"`, `"1m"`, `"500ms"`, `"1h30m"`, etc.
 * - `undefined` returns `undefined`.
 *
 * @param input  - Raw config value (number in ms, human-readable string, or undefined).
 * @returns Milliseconds as a number, or `undefined` if the input was undefined or could not be parsed.
 */
export function parseDuration(input: string | number | undefined): number | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "number") return input;
  const result = parse(input, "ms");
  return result != null ? result : undefined;
}
