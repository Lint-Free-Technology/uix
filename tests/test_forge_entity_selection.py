from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_selection(source: str) -> dict:
    script = """
const { buildSync } = require("esbuild");
const { text } = buildSync({
  stdin: { contents: process.argv[1], resolveDir: process.cwd() },
  bundle: true, platform: "node", write: false, format: "cjs",
}).outputFiles[0];
new Function("require", text)(require);
"""
    return json.loads(subprocess.check_output(["node", "-e", script, source], cwd=ROOT, text=True))


def test_lft_entity_filter_and_sort_syntax() -> None:
    results = run_selection(
        """
import { entitiesSparkEntries, selectEntities } from "./src/forge/entities-transform";
const now = Date.parse("2026-11-23T00:00:00Z");
const hass = {
  states: {
    "sensor.bed": { state: "8", attributes: { friendly_name: "Bedroom", flags: ["a", "b"] }, last_updated: "2026-11-22T23:59:00Z" },
    "sensor.hall": { state: "21", attributes: {}, last_updated: "2026-11-22T23:00:00Z" },
    "sensor.limit": { state: "20", attributes: {} },
    "sensor.other": { state: "unavailable", attributes: {} },
    "group.downstairs": { state: "on", attributes: { entity_id: ["sensor.hall", "group.house"] } },
    "group.house": { state: "on", attributes: { entity_id: ["sensor.bed", "group.downstairs"] } },
  },
  entities: { "sensor.bed": { device_id: "bed", labels: ["track_this"], platform: "test" }, "sensor.hall": { area_id: "hall" } },
  devices: { bed: { id: "bed", area_id: "bedroom", manufacturer: "Example", model: "A2", labels: ["on_device"] } },
  areas: { bedroom: { area_id: "bedroom", floor_id: "first" }, hall: { area_id: "hall", labels: ["track_this"] } },
  floors: { first: { floor_id: "first", level: 1 } },
  labels: { track_this: { label_id: "track_this", name: "Track this" } },
  uixEntityRegistry: {
    "sensor.bed": { hidden_by: "user", config_entry_id: "configuration_id" },
    "sensor.hall": { hidden_by: "integration" },
  },
  formatEntityState: ({ state }) => state === "unavailable" ? "Unavailable in locale" : state,
};
const ids = (filter) => selectEntities({ type: "entities", filter: { include: [filter] } }, hass, now).ids;
console.log(JSON.stringify({
  nested: ids({ group_expanded: { active_choice: "group", group: "group.house" } }),
  direct: ids({ group: "group.house" }),
  state: ids({ state: [{ operator: "<", entity_id: "sensor.limit" }, ">= 8"] }),
  translated: ids({ state_translated: "Unavailable in locale" }),
  attrs: ids({ attributes: { flags: '$$["a","b"]' }, last_updated: "< 2 m ago" }),
  device: ids({ device_manufacturer: "Example", device_model: "A2", level: ">= 1" }),
  named: ids({ label: "Track this", options: {} }),
  deviceLabel: ids({ label: "on_device" }),
  instance: ids({ integration: "configuration_id" }),
  userHidden: ids({ hidden_by: "user" }),
  integrationHidden: ids({ hidden_by: "integration" }),
  page: entitiesSparkEntries({
    type: "entities", filter: { include: [{ domain: "sensor" }] },
    sort: { method: "state", numeric: "nan_first", reverse: true, first: 1, count: 2 },
  }, hass, now).entries,
}));
"""
    )
    assert results == {
        "nested": ["sensor.bed", "sensor.hall"],
        "direct": ["group.downstairs", "sensor.bed"],
        "state": ["sensor.bed"],
        "translated": ["sensor.other"],
        "attrs": ["sensor.bed"],
        "device": ["sensor.bed"],
        "named": ["sensor.bed"],
        "deviceLabel": ["sensor.bed"],
        "instance": ["sensor.bed"],
        "userHidden": ["sensor.bed"],
        "integrationHidden": ["sensor.hall"],
        "page": ["sensor.hall", "sensor.limit"],
    }


def test_selection_registry_cache_shares_requests_and_observes_label_renames() -> None:
    results = run_selection(
        """
import { selectEntities } from "./src/forge/entities-transform";
import {
  entitySelectionHass, loadSelectionRegistries, selectionRegistryKinds, watchSelectionRegistries,
} from "./src/forge/entity-selection-registries";
const requests = [];
const events = {};
let label = "Before rename";
const hass = {
  states: { "sensor.bed": { state: "8" } },
  entities: { "sensor.bed": { labels: ["track_this"] } },
  connection: {
    subscribeEvents: async (callback, event) => { events[event] = callback; },
    sendMessagePromise: async ({ type }) => {
      requests.push(type);
      return [{ label_id: "track_this", name: label }];
    },
  },
};
const spark = { type: "entities", id: "selected", filter: { include: [{ and: [{ label: "Before rename" }] }] } };
const kinds = selectionRegistryKinds([spark]);
const select = () => selectEntities(spark, entitySelectionHass(hass)).ids;
(async () => {
  await loadSelectionRegistries(hass, selectionRegistryKinds([{ type: "entities", filter: { include: [{ domain: "sensor" }] } }]));
  await Promise.all([loadSelectionRegistries(hass, kinds), loadSelectionRegistries(hass, kinds)]);
  const before = select();
  const updated = new Promise((resolve) => {
    const stop = watchSelectionRegistries(hass, kinds, () => {
      stop();
      resolve(select());
    });
  });
  label = "After rename";
  events.label_registry_updated();
  const after = await updated;
  console.log(JSON.stringify({ before, after, requests, originalHass: Object.hasOwn(hass, "labels") }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
"""
    )
    assert results == {
        "before": ["sensor.bed"],
        "after": [],
        "requests": ["config/label_registry/list", "config/label_registry/list"],
        "originalHass": False,
    }
