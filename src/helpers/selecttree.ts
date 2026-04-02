import { Unpromise } from "@watchable/unpromise";

const TIMEOUT_ERROR = "SELECTTREE-TIMEOUT";

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

  // ID selector: #id
  const idRe = /#([a-zA-Z0-9_-]+)/g;
  let idM: RegExpExecArray | null;
  while ((idM = idRe.exec(s)) !== null) {
    if (element.id !== idM[1]) return false;
  }

  // Class selectors: .classname
  const classRe = /\.([a-zA-Z0-9_-]+)/g;
  let classM: RegExpExecArray | null;
  while ((classM = classRe.exec(s)) !== null) {
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

async function _selectTree(root, path, all = false) {
  let el = [root];

  // Split and clean path
  if (typeof path === "string") {
    path = path.split(/(\$| )/);
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
