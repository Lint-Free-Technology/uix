## [6.0.0](https://github.com/Lint-Free-Technology/uix/compare/v5.3.1...v6.0.0) (2026-04-01)

### ⚠ BREAKING CHANGES

* **toast:** Use uix-toast theme variable for toast notifications. uix-dialog will no longer apply to toast notifications.

### ⭐ New Features

* **major:** UIX Forge - see https://uix.lf.technology/forge ([#110](https://github.com/Lint-Free-Technology/uix/issues/110)) ([ec48f88](https://github.com/Lint-Free-Technology/uix/commit/ec48f88e62f65dacea496af90b3eafa74968b3f1)), closes [#98](https://github.com/Lint-Free-Technology/uix/issues/98)
* Add `&` host/element filter to yaml selector path syntax ([#121](https://github.com/Lint-Free-Technology/uix/issues/121)) ([4dfb987](https://github.com/Lint-Free-Technology/uix/commit/4dfb9875c8598a628566d21840198b822429b73d))
* Apply UIX to calendar panel ([833569c](https://github.com/Lint-Free-Technology/uix/commit/833569ca0e4069d92220ce46b32bf8bfdb811160))
* Apply UIX to calendar panel ([#129](https://github.com/Lint-Free-Technology/uix/issues/129)) ([7adc4c6](https://github.com/Lint-Free-Technology/uix/commit/7adc4c637a2a0bcea321aca48ed462bdde04b440))
* override entity images via --uix-image-for-<entityId> CSS variable ([#114](https://github.com/Lint-Free-Technology/uix/issues/114)) ([c70357f](https://github.com/Lint-Free-Technology/uix/commit/c70357fc2028f1070144aeb60e0f7bf85c7fa255))
* Section background color and opacity support ([#125](https://github.com/Lint-Free-Technology/uix/issues/125)) ([3f2b8f9](https://github.com/Lint-Free-Technology/uix/commit/3f2b8f91da944ea2867175fd8c89f5ee8fcf8672))

### 🐞 Bug Fixes

* **dialog:** Apply dialog patch on updated rather than showDialog to suit Home Assistant 2026.4.0 ([d055e07](https://github.com/Lint-Free-Technology/uix/commit/d055e0752ec18f7addce1c364c2b57e12143de56)), closes [#87](https://github.com/Lint-Free-Technology/uix/issues/87)
* **toast:** Correctly fix toast notifications reusing template variables ([#135](https://github.com/Lint-Free-Technology/uix/issues/135)) ([6b0d566](https://github.com/Lint-Free-Technology/uix/commit/6b0d5665114bfa45f646d89f5b67256b265bdf9f)), closes [#127](https://github.com/Lint-Free-Technology/uix/issues/127)

### ⚙️ Miscellaneous

* **console_debug:** Update uix_forge_pah to include class specificity when required ([#115](https://github.com/Lint-Free-Technology/uix/issues/115)) ([ab5ea6f](https://github.com/Lint-Free-Technology/uix/commit/ab5ea6ff712e47531ff8d3637c485a077bdc8f62))

## [5.3.1](https://github.com/Lint-Free-Technology/uix/compare/v5.3.0...v5.3.1) (2026-03-15)

### 🐞 Bug Fixes

* Console error with uix_path(). Don't allow selection of shadow root. ([#83](https://github.com/Lint-Free-Technology/uix/issues/83)) ([d61692d](https://github.com/Lint-Free-Technology/uix/commit/d61692d4ad473ae2311ba5a32530c5fbb117cb54))
* **console_debug:** correct shadow-root path key for dialog/theme elements and add theme boilerplate ([#94](https://github.com/Lint-Free-Technology/uix/issues/94)) ([85bcea8](https://github.com/Lint-Free-Technology/uix/commit/85bcea816daf35b05f1b2da9a73b1b78cc6ea82a)), closes [#86](https://github.com/Lint-Free-Technology/uix/issues/86) [#86](https://github.com/Lint-Free-Technology/uix/issues/86)

### 📔 Documentation

* Change card-mod to UIX in cards doc ([#92](https://github.com/Lint-Free-Technology/uix/issues/92)) ([48bc6d1](https://github.com/Lint-Free-Technology/uix/commit/48bc6d13da664bf2c9ee652527640c9c10a8f7dd))
* Expand theme documentation section ([#93](https://github.com/Lint-Free-Technology/uix/issues/93)) ([73a463b](https://github.com/Lint-Free-Technology/uix/commit/73a463ba617544be90e436979d002e70fbd5088f))

### 📦 Dependency Upgrades

* bump tar and npm ([#85](https://github.com/Lint-Free-Technology/uix/issues/85)) ([be38cbc](https://github.com/Lint-Free-Technology/uix/commit/be38cbc53956fa8b56aa8c1d90609960ab4c6638))

## [5.3.0](https://github.com/Lint-Free-Technology/uix/compare/v5.2.2...v5.3.0) (2026-03-09)

### ⭐ New Features

* Add UIX parent variables to uix_tree() and uix_path(). ([6e027b3](https://github.com/Lint-Free-Technology/uix/commit/6e027b3e125a1a7520b752fabd5bc7e8091601ce))
* DOM inspecton helpers uix_tree() and uix_path() ([#78](https://github.com/Lint-Free-Technology/uix/issues/78)) ([51cabd5](https://github.com/Lint-Free-Technology/uix/commit/51cabd5fb5665131b6dd272b6269a03579d02a84))
* Macro support for UIX templates - See https://uix.lf.technology/using/templates/[#macros](https://github.com/Lint-Free-Technology/uix/issues/macros) ([#75](https://github.com/Lint-Free-Technology/uix/issues/75)) ([3f6dd64](https://github.com/Lint-Free-Technology/uix/commit/3f6dd64a504d2760503b315803c9f08f02c6e034))

### 🐞 Bug Fixes

* Applying Uix to section strategy causes it to not show and console errors ([899163e](https://github.com/Lint-Free-Technology/uix/commit/899163ee2dd07b6b060d46f91e148a54013ac60b))

### 📔 Documentation

* Update documentation for release ([1d7cf79](https://github.com/Lint-Free-Technology/uix/commit/1d7cf7900c5c1eb148e9b7917b047e2f6d554a20))

## [5.2.1](https://github.com/Lint-Free-Technology/uix/compare/v5.2.0...v5.2.1) (2026-03-03)

### 🐞 Bug Fixes

* hassfest updates ahead of submission to HACS ([065dc1c](https://github.com/Lint-Free-Technology/uix/commit/065dc1cbe07297bdd73aa0023722ad44be317dee))

### ⚙️ Miscellaneous

* Uix naming in integration code and dev container ([f6a782a](https://github.com/Lint-Free-Technology/uix/commit/f6a782af9c4e023cebc42f2150082f1bb0d39242))

## [5.2.0](https://github.com/Lint-Free-Technology/uix/compare/v5.1.0...v5.2.0) (2026-02-27)

### ⭐ New Features

* Add dashboard resources and extra_module_url to UIX diagnostics download ([7219214](https://github.com/Lint-Free-Technology/uix/commit/72192140504caa065f1be64832ddba9ea7f66282)), closes [#57](https://github.com/Lint-Free-Technology/uix/issues/57)

### 🐞 Bug Fixes

* Apply dialog patch to edit card dialog. Previously this was missed by dialog patch as edit card has its own patch for brush icon. ([ae1d818](https://github.com/Lint-Free-Technology/uix/commit/ae1d8184b58a7cc43af2c849440004f829416106))

### ⚙️ Miscellaneous

* Add local brand icons which can be used by Home Assistant 2026.3+ ([4bf0662](https://github.com/Lint-Free-Technology/uix/commit/4bf0662a00e17f8d036f432929e7d5eaaafeaaeb))

## [5.1.0](https://github.com/Lint-Free-Technology/uix/compare/v5.0.0...v5.1.0) (2026-02-24)

### ⭐ New Features

* Support for notifications via Home Assistant notification manager and ha-toast element. ([e8e2297](https://github.com/Lint-Free-Technology/uix/commit/e8e2297eca9be3aa077338b737f0797b3f4859f3)), closes [#51](https://github.com/Lint-Free-Technology/uix/issues/51)

### 🐞 Bug Fixes

* Fix --uix-icon not working ha-icon-button (and any other element that does not use ha-icon in slot) ([34a71d2](https://github.com/Lint-Free-Technology/uix/commit/34a71d281c67ae16c1ff4e21445f3e684c00b9da)), closes [#54](https://github.com/Lint-Free-Technology/uix/issues/54)
* Use custom card's original config (hui-card) if uix and card_mod are empty in custom card's altered config. ([7ce8830](https://github.com/Lint-Free-Technology/uix/commit/7ce883093c566cf9eff7833435b8549db80ec3d5)), closes [#56](https://github.com/Lint-Free-Technology/uix/issues/56)

## [5.0.0](https://github.com/Lint-Free-Technology/uix/compare/v4.2.1...v5.0.0) (2026-02-22)

### ⭐ New Features

* Apply UIX to ha-panel-profile ([6bd54f7](https://github.com/Lint-Free-Technology/uix/commit/6bd54f7b9c9d479f8bf845eed9b670a7fcaa9b5e))

### 🐞 Bug Fixes

* Add ha-adaptive-dialog to dialogs where UIX is added. Remove old ha-wa-dialog and ha-md-dialog. ([6f186a8](https://github.com/Lint-Free-Technology/uix/commit/6f186a8c792e274f26bf505b11ffc70365a265b3))
* Fix reading uix-theme. ([b645d17](https://github.com/Lint-Free-Technology/uix/commit/b645d17d12e95b43f57f133e911e094e38e7d81f))
* Restore babel in rollup ([d216a38](https://github.com/Lint-Free-Technology/uix/commit/d216a3895f90c090d8ff6191d197d5259f31d79b))
* Restore ha-wa-dialog and ha-md-dialog until 2026.3 ([beff1bd](https://github.com/Lint-Free-Technology/uix/commit/beff1bd3e6c1d260b50d40300099d87be93e99f7))
* UIX not showing in UI editor when editing card ([1520a9c](https://github.com/Lint-Free-Technology/uix/commit/1520a9cb72e0d4f2752b4e41cb95a71f37507768))
* Update theme load warning to UIX ([17ac8d8](https://github.com/Lint-Free-Technology/uix/commit/17ac8d883df7342ba488cd35e1edbdc8ec085578))

### ⚙️ Miscellaneous

* Adjust Toast reload warning to be more friendly. ([a0cbe37](https://github.com/Lint-Free-Technology/uix/commit/a0cbe3799dd448f71d4980d30989d26a8d202e9f))
* Migrate to UIX ([b6c0672](https://github.com/Lint-Free-Technology/uix/commit/b6c0672f4a134429c32d6484e059506cbda9ab14))
