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
    ├── scenario_runner.py   # YAML scenario engine (load, push, navigate, assert, doc images)
    ├── snapshots/           # Baseline PNG snapshots (committed; compared by assert_snapshot)
    ├── test_scenarios.py    # Parametrised test — one test per YAML file
    ├── test_doc_images.py   # Parametrised test — generates/verifies documentation images
    ├── test_uix_styling.py  # Smoke tests (HA boots, UIX integration visible, no JS errors)
    └── scenarios/
        ├── styling/         # Card CSS, template, macro, and theme scenarios
        └── forge/           # UIX-Forge scenarios

docs/
└── scenarios/               # Documentation-image-only scenarios (must declare doc_image:)
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
    threshold: 0.001          # optional — fraction of pixels that may differ (default: 0)
```

The `threshold` field (0.0–1.0) lets you tolerate minor cross-platform rendering
differences (e.g. sub-pixel font hinting on macOS vs Linux) without masking real
visual regressions.  A value of `0.001` allows up to 0.1 % of pixels to differ.
Leave it unset (or set it to `0`) for an exact pixel-perfect comparison.

> **Cross-platform note:** Snapshot baselines in `tests/visual/snapshots/` were
> created on a specific OS/font stack.  If you run tests on a different operating
> system and the only failures are in snapshot assertions, the most likely cause
> is OS-level font rendering differences.  See [Updating snapshot baselines](#updating-snapshot-baselines) for how to regenerate them on your machine.

---

## Updating snapshot baselines

Baseline PNGs are stored in `tests/visual/snapshots/` and committed to the
repository.  They were created on a specific OS/font stack, so they may not
match pixel-for-pixel on a different operating system (e.g. macOS vs Linux).

### After an intentional visual change

Delete the affected baselines and re-run — new baselines are written automatically:

```bash
# Delete one baseline
rm tests/visual/snapshots/my_scenario_name.png

# Delete all baselines (regenerate everything)
rm tests/visual/snapshots/*.png

pytest tests/visual/test_scenarios.py
```

### When running on a different OS / platform (cross-platform snapshots)

Snapshot failures caused purely by OS-level font rendering (not by a real
visual regression) look nearly identical to the eye but fail pixel comparison.
The fastest fix is to regenerate all baselines for your environment using the
`SNAPSHOT_UPDATE=1` flag — **do not commit these regenerated baselines** unless
you are intentionally replacing the canonical set:

```bash
SNAPSHOT_UPDATE=1 pytest tests/visual/test_scenarios.py
```

Alternatively, add a `threshold` field to the failing scenario's snapshot
assertion (see [Assertion types](#assertion-types)) so that a small fraction of
differing pixels is tolerated on all platforms:

```yaml
assertions:
  - type: snapshot
    name: 01_card_basic_style
    threshold: 0.002    # allow up to 0.2 % of pixels to differ
```

---

## Adding a new scenario

1. Create a `.yaml` file anywhere under `tests/visual/scenarios/` (sub-directories are fine).
2. Fill in at minimum: `id`, `view_path`, `cards`, and `assertions`.
3. Run `pytest tests/visual/test_scenarios.py -k <your_id>` — the first run writes the baseline snapshot.
4. Commit the new `.yaml` **and** the new `.png` in `tests/visual/snapshots/`.

---

## Documentation images

The `doc_image:` key in a scenario YAML links a scenario to a documentation
page asset.  Scenarios that declare it are picked up by
`tests/visual/test_doc_images.py` and the resulting cropped screenshot is saved
(and compared) at the specified path inside the repository.

### Quick commands (Makefile aliases)

```bash
# Generate any missing doc images (first-run bootstrap, verifies existing ones)
make doc_images_gen

# Force-regenerate ALL doc images (use after an intentional HA/UIX visual change)
make doc_images_update
```

### Running directly with pytest

Environment variables are passed to pytest using the `VAR=value pytest ...` syntax
on Linux/macOS, or `set VAR=value && pytest ...` on Windows:

```bash
# Generate / verify all doc images
pytest tests/visual/test_doc_images.py

# Run a single doc image test by scenario id
pytest tests/visual/test_doc_images.py -k doc_theme_red_basic

# Force-regenerate all doc images (overwrites existing files)
DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py

# Force-regenerate a single image and also pin a specific HA version
HA_VERSION=2025.1.0 DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py -k doc_theme_red_basic
```

### Schema reference

Add a `doc_image:` block to any scenario YAML (alongside `card:`, `assertions:`, etc.):

```yaml
doc_image:
  output: docs/source/assets/page-assets/using/my-feature.png  # relative to repo root
  root: hui-entities-card   # shadow-piercing CSS selector for the element to crop
  padding: 16               # optional — pixels of whitespace border around element (default 0)
  threshold: 0.02           # optional — pixel-diff tolerance 0.0–1.0 (default 0)
```

| Key | Required | Description |
|-----|----------|-------------|
| `output` | ✅ | Output PNG path relative to the repository root.  Parent directories are created automatically. |
| `root` | — | Shadow-piercing CSS selector for the element whose bounding box defines the crop.  When omitted the full viewport is captured. |
| `padding` | — | Extra pixels added on each side of the element's bounding box. |
| `threshold` | — | Maximum fraction of pixels (0.0–1.0) that may differ from the on-disk file before the test fails.  Mirrors the `threshold` field on snapshot assertions. |

### Behaviour

* **First run (no existing file):** the image is written automatically.
* **Subsequent runs:** the freshly captured PNG is compared to the on-disk file.
  The test fails when the diff exceeds `threshold`, indicating that the
  documentation image needs updating.
* **`DOC_IMAGE_UPDATE=1`:** always overwrites the on-disk file, regardless of
  differences.  Use this after an intentional visual change to UIX or HA, then
  commit the updated PNGs.

### Where to put doc image scenarios

* If the scenario also has functional `assertions:`, add `doc_image:` to the
  same YAML — the same HA state is used for both the test and the image.
* If the scenario exists solely to capture a documentation image (no functional
  assertions), place it under `docs/scenarios/` instead of `tests/visual/scenarios/`.
  Scenarios in `docs/scenarios/` **must** declare `doc_image:` and are never
  run by `test_scenarios.py`.

### Update workflow

When a Home Assistant update causes a doc image to look different:

```bash
# 1. Regenerate all doc images
make doc_images_update

# 2. Review the diff, then commit
git add docs/source/assets/page-assets/
git commit -m "docs: regenerate documentation images for HA X.Y"
```
