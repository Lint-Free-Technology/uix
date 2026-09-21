// Web Awesome 3.7.0-ha.1 installs a replaceSync wrapper even when the API is
// absent. On iOS 15 that creates a non-writable, non-configurable property, so
// the second copy (Home Assistant or UIX) throws during module evaluation.
// Keep StateSet and the modern-browser patch, but leave legacy CSSOM alone.
// https://github.com/Lint-Free-Technology/uix/issues/629
const stateSetModule = "/@home-assistant/webawesome/dist/utilities/polyfills/stateset.js";
const upstreamPatch = String.raw`const replaceSync = CSSStyleSheet.prototype.replaceSync;
Object.defineProperty(CSSStyleSheet.prototype, "replaceSync", {
  value: function(text) {
    text = text.replace(/:state\(([^)]+)\)/g, ":where(:state($1), :--$1, [state-$1])");
    replaceSync.call(this, text);
  }
});`;

export default function webAwesomeCompatibility() {
  return {
    name: "uix-webawesome-compatibility",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith(stateSetModule)) return null;

      // Fail visibly on dependency changes rather than silently shipping the
      // unguarded patch again. Revisit this workaround when upstream fixes it.
      if (!code.includes(upstreamPatch)) {
        this.error("Web Awesome StateSet changed; review the iOS 15 compatibility patch.");
      }

      return {
        code: code.replace(upstreamPatch, `
// Check replace as well: HA may already have installed its broken replaceSync
// wrapper on a browser without constructible stylesheets.
if (typeof CSSStyleSheet !== "undefined" &&
    typeof CSSStyleSheet.prototype.replace === "function" &&
    typeof CSSStyleSheet.prototype.replaceSync === "function") {
${upstreamPatch}
}
`),
        map: null,
      };
    },
  };
}
