type Matcher = (value: any) => boolean;

const comparisons: Record<string, (left: string | number, right: string | number) => boolean> = {
  "<": (left, right) => left < right,
  "<=": (left, right) => left <= right,
  ">": (left, right) => left > right,
  ">=": (left, right) => left >= right,
  "=": (left, right) => left === right,
  "==": (left, right) => left === right,
  "!": (left, right) => left !== right,
  "!=": (left, right) => left !== right,
};

export function filterRuleKey(key: string): string {
  return key.trim().split(/\s+/, 1)[0];
}

/** Accept both hand-written values and values saved by the choose selector. */
export function filterChoice(value: any): any {
  if (typeof value?.active_choice !== "string") return value;
  return Object.prototype.hasOwnProperty.call(value, value.active_choice) ? value[value.active_choice] : undefined;
}

export function entityValueMatcher(pattern: any, now: number, ignoreCase = false, age = false): Matcher {
  pattern = filterChoice(pattern);
  if (Array.isArray(pattern)) {
    const alternatives = pattern.map((item) => entityValueMatcher(item, now, ignoreCase, age));
    return (value) => alternatives.some((match) => match(value));
  }
  if (typeof pattern !== "string") return (value) => value !== undefined && value === pattern;

  const json = pattern.startsWith("$$");
  if (json) pattern = pattern.slice(2);
  const period = /([mhd])\s+ago\s*$/i.exec(pattern);
  if (period) pattern = pattern.slice(0, period.index);
  const unit = period?.[1].toLowerCase();
  const minutes = unit === "d" ? 1440 : unit === "h" ? 60 : 1;

  const lastSlash = pattern.lastIndexOf("/");
  let regex: RegExp | undefined;
  if (pattern.startsWith("/") && lastSlash > 0) {
    const flags = pattern.slice(lastSlash + 1).replace(/[gy]/g, "");
    try {
      regex = new RegExp(pattern.slice(1, lastSlash), ignoreCase && !flags.includes("i") ? flags + "i" : flags);
    } catch (_error) {
      throw new Error(`uix-forge: entities Spark has invalid regular expression ${pattern}`);
    }
  } else if (pattern.includes("*")) {
    const glob = pattern.split("*").map((part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    regex = new RegExp(`^${glob}$`, ignoreCase ? "i" : "");
  }
  const comparison = /^(<=|>=|==|!=|<|>|=|!)(.*)$/.exec(pattern);
  if (ignoreCase) pattern = pattern.toLowerCase();
  return (value) => {
    if (value === undefined) return false;
    const candidate = json ? JSON.stringify(value) : value;
    if (regex) return typeof candidate === "string" && regex.test(candidate);
    if (comparison) {
      const left = age || period
        ? candidate == null ? NaN : (now - new Date(candidate).getTime()) / (60000 * minutes)
        : parseFloat(candidate);
      return comparisons[comparison[1]](left, parseFloat(comparison[2]));
    }
    if (age || period) return false;
    return typeof candidate === "string" && (ignoreCase ? candidate.toLowerCase() : candidate) === pattern;
  };
}

/** State lists are conjunctions. Each condition can use a literal or another entity's state. */
export function entityStateMatcher(pattern: any, states: Record<string, any>, now: number, ignoreCase = false): Matcher {
  if (Array.isArray(pattern)) {
    const conditions = pattern.map((item) => entityStateMatcher(item, states, now, ignoreCase));
    return (value) => conditions.every((match) => match(value));
  }
  if (pattern == null || typeof pattern !== "object" || pattern.active_choice) {
    return pattern == null ? () => false : entityValueMatcher(pattern, now, ignoreCase);
  }
  const ignore = ignoreCase || pattern.ignore_case === true;
  if (Array.isArray(pattern.and)) return entityStateMatcher(pattern.and, states, now, ignore);
  if (Array.isArray(pattern.or)) {
    const conditions = pattern.or.map((item: any) => entityStateMatcher(item, states, now, ignore));
    return (value) => conditions.some((match: Matcher) => match(value));
  }
  if (pattern.not !== undefined) {
    const match = entityStateMatcher(pattern.not, states, now, ignore);
    return (value) => !match(value);
  }
  if (pattern.operator === undefined && pattern.entity_id === undefined) return entityValueMatcher(pattern.value, now, ignore);
  const compare = Object.prototype.hasOwnProperty.call(comparisons, pattern.operator ?? "==")
    ? comparisons[pattern.operator ?? "=="]
    : undefined;
  const target = pattern.entity_id === undefined ? pattern.value : states[pattern.entity_id]?.state;
  return (value) => {
    if (!compare || value == null || target == null) return false;
    const normalise = (input: any) => ignore ? String(input).trim().toLowerCase() : String(input).trim();
    const left = normalise(value);
    const right = normalise(target);
    const leftNumber = parseFloat(left);
    const rightNumber = parseFloat(right);
    return Number.isNaN(leftNumber) || Number.isNaN(rightNumber)
      ? compare(left, right)
      : compare(leftNumber, rightNumber);
  };
}
