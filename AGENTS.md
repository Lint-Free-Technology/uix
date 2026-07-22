# UIX

UIX is a Home Assistant custom integration for CSS and element customisation and augmentation.

Before changing behaviour, read:
/docs/concepts/*.md

## Repository

custom_components/uix/
src/
tests/

## Docs

docs/

If modifying:

- Templates → docs/source/using/templates.md
- Forge → docs/source/forge/forge.md
- Sparks → docs/source/forge/index.md and make sure to update navigation lists
- DOM navigation → docs/source/concepts/dom.md

## Coding

- Follow existing style.
- Keep card-mod compatibility unless explicitly removing it.
- Never break existing YAML syntax.
- New user features require documentation.
- Bug fixes require regression tests where practical.

## Build

npm run build

## Testing

Only test if instructed to. Otherwise submit work only.

Testing needs a virtual python environment. If `.venv` exists assume you are working on a setup environment and proceed ro run Home Assistant persistent server.

- python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[test]' && playwright install chromium

For a session you save considerable time running Home Assistant persistent server

- source .venv/bin/activate && HA_VERSION=$(awk 'NF && $1 !~ /^#/ { print; exit }' tests/HA_VERSION 2>/dev/null || true) && HA_VERSION=${HA_VERSION:-stable} HA_CONFIG_PATH=tests/ha-config HA_CUSTOM_COMPONENTS_PATH=custom_components HA_SETUP_INTEGRATION=uix HA_PLUGINS_YAML=tests/plugins.yaml python -m ha_testcontainer.ha_server

Then run specific test

- source .venv/bin/activate && source .ha_env 2>/dev/null; pytest tests/visual/test_scenarios.py -k '${input:scenarioId}'

To update a specific test when snapshot output already exists

- source .venv/bin/activate && source .ha_env 2>/dev/null; SNAPSHOT_UPDATE=1 pytest tests/visual/test_scenarios.py -k '${input:scenarioId}'

Never run all tests as this will bog down your session

## Commits and PRs

- Never commit build artifact custom_components/uix/uix.js
- Never commit build artifact custom_components/uix/uix.js.gz
