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

For a session you save considerable time running Home Assistant persistent server

- make ha_up

Then run specific test

- pytest tests/visual/test_scenarios.py -k SCENARIO_ID

Never run all tests as this will bog down your session

## Commits and PRs

- Never commit build artifact custom_components/uix/uix.js
- Never commit build artifact custom_components/uix/uix.js.gz
