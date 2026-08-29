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

## External documentation translations

- The English documentation in this repository is canonical. Do not add or
  accept translated Markdown copies here.
- Translation curators register independently hosted translations by changing
  only `docs/translations.json`. Do not edit generated release files or add a
  translation directly to `docs/mkdocs.yml`.
- Each registry entry must use a lowercase ISO 639-1 language code, a native
  language name, and public HTTPS site and metadata URLs.
- A translation fork uses `docs/site.json` to set its language, native name,
  public site URL, and canonical English URL before running the same docs
  release workflow. Its localized footer notice must contain the required
  `{canonical}` placeholder. Preserve this workflow's fork compatibility.
- Translation forks retain the canonical English files in `docs/source` and
  place their translated files in `docs/source-<language>`. The release
  preparation selects that directory automatically; do not change `docs_dir`
  in `docs/mkdocs.yml`.
- A translation must publish the `uix-docs.json` metadata contract described in
  `docs/source/contributing.md`. The documentation release workflow decides
  whether it is current enough to display; unavailable, invalid, or stale
  translations must be omitted with a workflow warning rather than blocking
  publication.
- Translation publication also generates `uix_sites.json`. Preserve its
  canonical and language-alternate metadata, and keep the daily health check
  warning-only: an unhealthy curator site must not fail the workflow.
- Do not change the metadata schema, the one-minor-version eligibility policy,
  prerelease policy (previous minor only), or the generated footer version
  without explicit maintainer approval.

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

- `python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[test]' && playwright install chromium`

For a session you save considerable time running Home Assistant persistent server

- `source .venv/bin/activate && HA_VERSION=$(awk 'NF && $1 !~ /^#/ { print; exit }' tests/HA_VERSION 2>/dev/null || true) && HA_VERSION=${HA_VERSION:-stable} HA_CONFIG_PATH=tests/ha-config HA_CUSTOM_COMPONENTS_PATH=custom_components HA_SETUP_INTEGRATION=uix HA_PLUGINS_YAML=tests/plugins.yaml python -m ha_testcontainer.ha_server`

Then run specific test

- `source .venv/bin/activate && source .ha_env 2>/dev/null; pytest tests/visual/test_scenarios.py -k '${input:scenarioId}'`

To update a specific test when snapshot output already exists

- `source .venv/bin/activate && source .ha_env 2>/dev/null; SNAPSHOT_UPDATE=1 pytest tests/visual/test_scenarios.py -k '${input:scenarioId}'`

Never run all tests as this will bog down your session

## Commits and PRs

- Never commit build artifact custom_components/uix/uix.js
- Never commit build artifact custom_components/uix/uix.js.gz
