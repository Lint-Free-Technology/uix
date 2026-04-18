import { Unpromise } from "@watchable/unpromise";

const TIMEOUT_ERROR = "SELECTTREE-TIMEOUT";
const INTEGER_RE = /^\d+$/;

/**
 * Checks whether an element matches a simple selector by directly inspecting
 * its properties — without relying on Element.matches() (which uses CSS scope
 * semantics that may not apply to shadow-root hosts or detached parents).
 *
 * Supported tokens (all must match):
 *   tagname       — element.localName === 'tagname'
 *   .classname    — element.classList.contains('classname')
 *   #id           — element.id === 'id'
 *   [attr]        — element.hasAttribute('attr')
 *   [attr=val]    — element.getAttribute('attr') === val
 *   [attr^=val]   — starts-with
 *   [attr$=val]   — ends-with
 *   [attr*=val]   — contains
 *   [attr~=val]   — whitespace-separated word match
 *   [attr|=val]   — val or val- prefix
 *
 * Combinations (e.g. ha-dialog.my-class[data-type="x"]) are supported; all
 * tokens must match. Spaces within the selector are not supported.
 *
 * Supported pseudo-classes:
 *   :empty        — element has no child elements (light DOM is empty)
 *   :shadow-empty — element has no shadow root, or its shadow root has no
 *                   child elements
 *
 * Property selectors  {.prop.path}  navigate actual JS element properties
 * (not HTML attributes).  Dot-separated paths are followed with optional
 * chaining; plain integers in the path are treated as array indices.
 * The resolved value is coerced to a string for comparisons.
 *   {.prop}             — property exists (not null/undefined)
 *   {.prop=val}         — property (as string) equals val
 *   {.prop^=val}        — starts-with
 *   {.prop$=val}        — ends-with
 *   {.prop*=val}        — contains
 *   {.prop~=val}        — whitespace-separated word match
 *   {.prop|=val}        — val or val- prefix
 * Values may be quoted ("val" or 'val') or bare.
 * Examples:
 *   &{.notification.notification_id='1234567'}
 *   &{.items.0.name='foo'}
 */
function pseudoMatches(element: Element, selector: string): boolean {
  let s = selector.trim();
  if (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }

  // Tag name — must appear at the very start of the selector
  const tagMatch = s.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) {
    if (element.localName !== tagMatch[1].toLowerCase()) return false;
    s = s.slice(tagMatch[1].length);
  }

  // Strip attribute and property selectors before checking class/ID/pseudo to
  // avoid false matches on content inside their values (e.g. [attr='#id'],
  // [attr=':empty'], or {.notification.id='foo.bar'})
  const sForClassId = s.replace(/\[[^\]]*\]/g, "").replace(/\{[^}]*\}/g, "");

  // ID selector: #id
  const idRe = /#([a-zA-Z0-9_-]+)/g;
  let idM: RegExpExecArray | null;
  while ((idM = idRe.exec(sForClassId)) !== null) {
    if (element.id !== idM[1]) return false;
  }

  // Class selectors: .classname
  const classRe = /\.([a-zA-Z0-9_-]+)/g;
  let classM: RegExpExecArray | null;
  while ((classM = classRe.exec(sForClassId)) !== null) {
    if (!element.classList.contains(classM[1])) return false;
  }

  // Attribute selectors: [attr], [attr=val], [attr^=val], etc.
  const attrRe = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(s)) !== null) {
    const inner = m[1];
    const opMatch = inner.match(
      /^([a-zA-Z][a-zA-Z0-9_:-]*)\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*))$/
    );
    if (opMatch) {
      const [, name, op, dqVal, sqVal, rawVal] = opMatch;
      const val = dqVal ?? sqVal ?? rawVal ?? "";
      const attrVal = element.getAttribute(name) ?? "";
      if (op === "=" && attrVal !== val) return false;
      if (op === "~=" && !attrVal.split(/\s+/).includes(val)) return false;
      if (op === "^=" && !attrVal.startsWith(val)) return false;
      if (op === "$=" && !attrVal.endsWith(val)) return false;
      if (op === "*=" && !attrVal.includes(val)) return false;
      if (op === "|=" && attrVal !== val && !attrVal.startsWith(`${val}-`))
        return false;
    } else {
      // Bare [attr] — presence check
      if (!element.hasAttribute(inner.trim())) return false;
    }
  }

  // Property selectors: {.prop.path}, {.prop.path=val}, etc.
  // Navigates actual JS element properties via a dot-separated path.
  const propRe = /\{([^}]+)\}/g;
  let pm: RegExpExecArray | null;
  while ((pm = propRe.exec(s)) !== null) {
    const inner = pm[1];
    const propOpMatch = inner.match(
      // Groups: 1=dotted-path, 2=op, 3=double-quoted val, 4=single-quoted val, 5=bare val
      // Each path segment is either a plain integer (array index) or a JS identifier.
      /^((?:\.(?:[0-9]+|[a-zA-Z_$][a-zA-Z0-9_$]*))+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s}]*)))?$/
    );
    if (propOpMatch) {
      const [, path, op, dqVal, sqVal, rawVal] = propOpMatch;
      // Navigate the dot-separated property path with optional chaining.
      // Pure-integer segments are used as array indices.
      const keys = path.slice(1).split(".");
      let propVal: unknown = element;
      for (const key of keys) {
        if (propVal == null || typeof propVal !== "object") {
          propVal = undefined;
          break;
        }
        const idx = INTEGER_RE.test(key) ? parseInt(key, 10) : key;
        propVal = Array.isArray(propVal) && typeof idx === "number"
          ? (propVal as unknown[])[idx]
          : (propVal as Record<string | number, unknown>)[idx];
      }
      if (op) {
        const expected = dqVal ?? sqVal ?? rawVal ?? "";
        const actual = String(propVal ?? "");
        if (op === "=" && actual !== expected) return false;
        if (op === "~=" && !actual.split(/\s+/).filter(Boolean).includes(expected)) return false;
        if (op === "^=" && !actual.startsWith(expected)) return false;
        if (op === "$=" && !actual.endsWith(expected)) return false;
        if (op === "*=" && !actual.includes(expected)) return false;
        if (
          op === "|=" &&
          actual !== expected &&
          !actual.startsWith(`${expected}-`)
        )
          return false;
      } else {
        // Bare {.prop} — presence check (not null/undefined)
        if (propVal == null) return false;
      }
    }
  }

  return true;
}

export async function await_element(el, hard = false) {
  if (el.localName?.includes("-"))
    await customElements.whenDefined(el.localName);
  if (el.updateComplete) await el.updateComplete;
  if (hard) {
    if (el.pageRendered) await el.pageRendered;
    if (el._panelState) {
      let rounds = 0;
      while (el._panelState !== "loaded" && rounds++ < 5)
        await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/**
 * Splits a UIX path string on `$` and space separators, but ignores any `$`
 * or space that appears inside an attribute-selector bracket `[...]`, a
 * property-selector brace `{...}`, or inside quoted strings within those
 * delimiters.  This preserves CSS attribute selectors like
 * `[attr$='value']` or `[attr='val with spaces']` and property selectors like
 * `{.prop='val with spaces'}` as single tokens.
 */
function splitPath(path: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (inSingleQuote) {
      if (c === "'") inSingleQuote = false;
      current += c;
    } else if (inDoubleQuote) {
      if (c === '"') inDoubleQuote = false;
      current += c;
    } else if (depth > 0) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === "'") inSingleQuote = true;
      else if (c === '"') inDoubleQuote = true;
      current += c;
    } else if (c === "$" || c === " ") {
      tokens.push(current);
      tokens.push(c);
      current = "";
    } else {
      if (c === "[" || c === "{") depth++;
      else if (c === "'") inSingleQuote = true;
      else if (c === '"') inDoubleQuote = true;
      current += c;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

async function _selectTree(root, path, all = false) {
  let el = [root];

  // Split and clean path
  if (typeof path === "string") {
    path = splitPath(path);
  }
  while (path[path.length - 1] === "") path.pop();

  // Handle optional leading & host/element filter (must be the first step).
  // If current elements are ShadowRoots, match against the host;
  // otherwise match against the element itself.
  if (path.length > 0 && path[0].startsWith("&")) {
    const selector = path.shift().slice(1);
    el = el.filter((e) => {
      if (!e) return false;
      const target =
        e instanceof ShadowRoot ? e.host : e;
      return target instanceof Element ? pseudoMatches(target, selector) : false;
    });
    while (path.length > 0 && !path[0].trim().length) path.shift();
  }

  // For each element in the path
  for (const [i, p] of path.entries()) {
    if (p === "$") {
      await Promise.all([...el].map((e) => await_element(e)));
      el = [...el].map((e) => e.shadowRoot);
      continue;
    }

    // Only pick the first one for the next step
    const e = el[0];
    if (!e) return null;

    if (!p.trim().length) continue;

    await await_element(e);
    el = e.querySelectorAll(p);
  }
  return all ? el : el[0];
}

export async function selectTree(root, path, all = false, timeout = 10000) {
  return Unpromise.race([
    _selectTree(root, path, all),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(TIMEOUT_ERROR)), timeout)
    ),
  ]).catch((err) => {
    if (!err.message || err.message !== TIMEOUT_ERROR) throw err;
    return null;
  });
}
