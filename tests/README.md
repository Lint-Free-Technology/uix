# UIX Tests

Automated tests for the UIX integration. Tests spin up a real Home Assistant
instance inside a Docker container (via
[ha-testcontainer](https://github.com/Lint-Free-Technology/ha-testcontainer))
and exercise UIX with a real browser (via [Playwright](https://playwright.dev/python/)).

---

## Prerequisites

- **Docker** — required to run the HA container.
- **Python ≥ 3.11**
- Create and activate a virtual environment, then install test dependencies and Playwright browsers:

  ```bash
  python3 -m venv .venv        # use 'python' on Windows
  source .venv/bin/activate    # Windows: .venv\Scripts\activate
  pip install -e ".[test]"
  playwright install chromium
  ```

---

## Running the tests

All commands should be run from the **repository root**.

### Run everything

```bash
pytest tests/
```

### Smoke tests only (no Lovelace scenarios)

```bash
pytest tests/visual/test_uix_styling.py
```

### Run all visual scenarios

```bash
pytest tests/visual/test_scenarios.py
```

### Run a single scenario by its `id`

```bash
pytest tests/visual/test_scenarios.py -k card_basic_style
```

### Filter scenarios by category

```bash
# All styling scenarios
pytest tests/visual/test_scenarios.py -k "styling or theme or macro"

# All forge scenarios
pytest tests/visual/test_scenarios.py -k forge
```

### Pin a specific HA version

```bash
HA_VERSION=2024.6.0 pytest tests/
```

Accepted values for `HA_VERSION`: `stable` (default), `beta`, `dev`, or a
pinned version string such as `2024.6.0`.

---

## Test structure

```
tests/
├── conftest.py              # Session-scoped HA container + Lovelace dashboard fixtures
├── ha-config/
│   ├── configuration.yaml   # HA configuration loaded by the test container
│   └── themes.yaml          # UIX test themes (referenced by scenario YAML files)
└── visual/
    ├── conftest.py          # Playwright browser context + page fixtures
    ├── lovelace_helpers.py  # push_lovelace_config_to() WS helper
    ├── scenario_runner.py   # YAML scenario engine (load, push, navigate, assert)
    ├── snapshots/           # Baseline PNG snapshots (committed; compared by assert_snapshot)
    ├── test_scenarios.py    # Parametrised test — one test per YAML file
    ├── test_uix_styling.py  # Smoke tests (HA boots, UIX integration visible, no JS errors)
    └── scenarios/
        ├── styling/         # Card CSS, template, macro, and theme scenarios
        └── forge/           # UIX-Forge scenarios
```

---

## Visual scenarios (YAML)

Each `.yaml` file under `tests/visual/scenarios/` defines one visual test.
No Python changes are needed to add a new scenario — just create a new file.

### Minimal example

```yaml
id: card_basic_style
description: A card with a red background via uix style
view_path: /lovelace-test/0
cards:
  - type: entities
    entities:
      - light.bed_light
    uix:
      style: |
        ha-card { background: red; }
assertions:
  - type: snapshot
    name: card_basic_style
```

### Full schema reference

| Key | Required | Description |
|-----|----------|-------------|
| `id` | ✅ | Unique identifier used as the pytest test ID and `-k` filter value |
| `description` | — | Human-readable description shown in pytest output |
| `view_path` | ✅ | URL path to navigate to after pushing the config (e.g. `/lovelace-test/0`) |
| `cards` | ✅ | List of Lovelace card configs pushed to the test dashboard |
| `theme` | — | HA theme name to activate before navigating (reset automatically after the test) |
| `interactions` | — | List of interactions to perform after navigation (see below) |
| `assertions` | ✅ | List of assertions to evaluate (see below) |

### Interaction types

Interactions run **after navigation** but **before assertions**.

**`hover`** — hover over an element:

```yaml
interactions:
  - type: hover
    selector: ha-card          # plain CSS selector (main document)
    settle_ms: 500             # optional, default 500 ms

  # Shadow-root traversal form:
  - type: hover
    root: hui-tile-card        # element(s) to enter shadow root of
    selector: ha-state-icon    # selector inside that shadow root
```

**`click`** — click an element (same selector forms as `hover`):

```yaml
interactions:
  - type: click
    selector: ha-button
```

**`ha_service`** — call a HA REST API service:

```yaml
interactions:
  - type: ha_service
    domain: light
    service: turn_on
    data:
      entity_id: light.bed_light
```

**`wait`** — wait for a fixed duration:

```yaml
interactions:
  - type: wait
    ms: 1000
```

### Assertion types

**`snapshot`** — compare a screenshot against the baseline in `tests/visual/snapshots/`:

```yaml
assertions:
  - type: snapshot
    name: my_scenario_name    # basename of the PNG file (without extension)
```

To **update baselines** after an intentional visual change, delete the relevant
`.png` files from `tests/visual/snapshots/` and re-run the tests — new baselines
are written automatically.

---

## Updating snapshot baselines

```bash
# Delete one baseline
rm tests/visual/snapshots/my_scenario_name.png

# Delete all baselines (regenerate everything)
rm tests/visual/snapshots/*.png

pytest tests/visual/test_scenarios.py
```

---

## Adding a new scenario

1. Create a `.yaml` file anywhere under `tests/visual/scenarios/` (sub-directories are fine).
2. Fill in at minimum: `id`, `view_path`, `cards`, and `assertions`.
3. Run `pytest tests/visual/test_scenarios.py -k <your_id>` — the first run writes the baseline snapshot.
4. Commit the new `.yaml` **and** the new `.png` in `tests/visual/snapshots/`.
