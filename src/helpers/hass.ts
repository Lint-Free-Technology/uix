import { Unpromise } from "@watchable/unpromise";

export async function hass_base_el() {
  await Unpromise.race([
    customElements.whenDefined("home-assistant"),
    customElements.whenDefined("hc-main"),
  ]);

  const element = customElements.get("home-assistant")
    ? "home-assistant"
    : "hc-main";

  while (!document.querySelector(element))
    await new Promise((r) => window.setTimeout(r, 100));
  return document.querySelector(element);
}

export async function hass() {
  const base: any = await hass_base_el();
  while (!base.hass) await new Promise((r) => window.setTimeout(r, 100));
  return base.hass;
}

export async function provideHass(el) {
  const base: any = await hass_base_el();
  base.provideHass(el);
}

const LOCALIZE_PATTERN = /__[^_]+__/g;

export const translate = (hass, text: String) => {
  return text.replace(LOCALIZE_PATTERN, (key) => {
    const params = key
      .slice(2, -2)
      .split(/\s*,\s*/);
    return hass?.localize?.apply(null, params) || key;
  });
};