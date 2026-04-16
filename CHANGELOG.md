## [6.3.0-beta.5](https://github.com/Lint-Free-Technology/uix/compare/v6.3.0-beta.4...v6.3.0-beta.5) (2026-04-16)

## [6.3.0-beta.4](https://github.com/Lint-Free-Technology/uix/compare/v6.3.0-beta.3...v6.3.0-beta.4) (2026-04-16)

### 🐞 Bug Fixes

* **forge:** Pass global entity config to forge uix styling ([bf49329](https://github.com/Lint-Free-Technology/uix/commit/bf493290043ad7fcab79544f383787d15390bac4))

### 📔 Documentation

* documentation image generation from scenario YAML files ([#218](https://github.com/Lint-Free-Technology/uix/issues/218)) ([411d165](https://github.com/Lint-Free-Technology/uix/commit/411d1655cd8608cb6b6df03405f8ac20bcea2897))
* Update tooltip spark documentation with animations ([f6a9bb8](https://github.com/Lint-Free-Technology/uix/commit/f6a9bb8e3a499949afd48b4f16360acb56d7367e))

### ⚙️ Miscellaneous

* add click_circle overlay for visualising clicks in doc animations ([#229](https://github.com/Lint-Free-Technology/uix/issues/229)) ([2eb732e](https://github.com/Lint-Free-Technology/uix/commit/2eb732e6563f0c95160a4536633da1dfbb67fd12))
* add cursor overlay support to doc_image and doc_animation ([#226](https://github.com/Lint-Free-Technology/uix/issues/226)) ([e045529](https://github.com/Lint-Free-Technology/uix/commit/e0455295b3ac695ec45fd00f5d1d63a569e359f6))
* Add hover_away interaction type to scenario runner ([#225](https://github.com/Lint-Free-Technology/uix/issues/225)) ([ad93b76](https://github.com/Lint-Free-Technology/uix/commit/ad93b762784fea5c410e21a5b4ff16956a79390a))
* add segments for interleaved interactions and frame capture ([#222](https://github.com/Lint-Free-Technology/uix/issues/222)) ([9e368ef](https://github.com/Lint-Free-Technology/uix/commit/9e368ef3b562fc9a040bbbcd89e7bbd4e24f4d24))
* allow CSS-like multi-value padding for snapshot, doc_image, doc_animation ([#228](https://github.com/Lint-Free-Technology/uix/issues/228)) ([7b085b2](https://github.com/Lint-Free-Technology/uix/commit/7b085b23ee6eecacc251f9992ce70f4d1f070ed0))
* doc_image stepped captures + doc_animation GIF support + doc image audit ([#219](https://github.com/Lint-Free-Technology/uix/issues/219)) ([cd50b2d](https://github.com/Lint-Free-Technology/uix/commit/cd50b2dd41f8801b5d5ae7840741306079979c3e))
* persistent HA dev server + VS Code task integration ([#230](https://github.com/Lint-Free-Technology/uix/issues/230)) ([4450256](https://github.com/Lint-Free-Technology/uix/commit/44502566fcb53633f9c01cee62417e2644c3b05d))
* support cards list in scenario runner alongside card ([#221](https://github.com/Lint-Free-Technology/uix/issues/221)) ([468a53a](https://github.com/Lint-Free-Technology/uix/commit/468a53a95a5c0454861d9f967003a2e9644867b8))
* wrap card in sections view and support dashboard key in push_scenario ([#220](https://github.com/Lint-Free-Technology/uix/issues/220)) ([a3180e5](https://github.com/Lint-Free-Technology/uix/commit/a3180e56e28e87743fee96b6b5e9d146abc5bba9))

## [6.3.0-beta.3](https://github.com/Lint-Free-Technology/uix/compare/v6.3.0-beta.2...v6.3.0-beta.3) (2026-04-13)

### ⚙️ Miscellaneous

* Map entity marker test ([#217](https://github.com/Lint-Free-Technology/uix/issues/217)) ([acdead6](https://github.com/Lint-Free-Technology/uix/commit/acdead646ee0dc02a858e1e534d075f3c3521965)), closes [#216](https://github.com/Lint-Free-Technology/uix/issues/216)
* **styling:** Correct new entity marker patch to provide variable config rather than entityConfig ([f1fb013](https://github.com/Lint-Free-Technology/uix/commit/f1fb013aaee290256bc0559b16c324469423e13b))

## [6.3.0-beta.2](https://github.com/Lint-Free-Technology/uix/compare/v6.3.0-beta.1...v6.3.0-beta.2) (2026-04-13)

### ⭐ New Features

* **styling:** Allow styling of entity markers either directly by config on map card or through theme variable `uix-entity-marker(-yaml)` ([#215](https://github.com/Lint-Free-Technology/uix/issues/215)) ([38c9009](https://github.com/Lint-Free-Technology/uix/commit/38c9009ba90d435f760db43b000077963a9fbe2b))

### 🐞 Bug Fixes

* `&` host/element selector broken by `$=` operator and `.` in attribute values. Allow spaces in attribute selection. ([#213](https://github.com/Lint-Free-Technology/uix/issues/213)) ([3416921](https://github.com/Lint-Free-Technology/uix/commit/3416921fc4ac697dc2aa40808063d85981ce4557))

### ⚙️ Miscellaneous

* **tests:** Update tests to use Lint-Free-Technology/ha-testcontainer with visual snapshot comparisons ([a521e48](https://github.com/Lint-Free-Technology/uix/commit/a521e48562e9933f6264c00f005f82180bbe1767))

## [6.3.0-beta.1](https://github.com/Lint-Free-Technology/uix/compare/v6.2.0...v6.3.0-beta.1) (2026-04-12)

### ⭐ New Features

* **styling:** allow for generic image override with --uix-image and fix entity override not updating once styling removed ([#210](https://github.com/Lint-Free-Technology/uix/issues/210)) ([7c64eda](https://github.com/Lint-Free-Technology/uix/commit/7c64edaeedbd75fad80c06f29fc021a073d571e2))

## [6.2.0](https://github.com/Lint-Free-Technology/uix/compare/v6.1.0...v6.2.0) (2026-04-11)

### ⭐ New Features

* **forge:** extend nested template syntax to multiple layers for nested forges (e.g. 3 layers `<<<`/`>>>`)  ([#202](https://github.com/Lint-Free-Technology/uix/issues/202)) ([b1a6b62](https://github.com/Lint-Free-Technology/uix/commit/b1a6b629abfd6cdffd4652a8b11700d8d477b208)), closes [#201](https://github.com/Lint-Free-Technology/uix/issues/201)
* **forge:** Support UIX Forge to be card for auto-entities allowing and passing entities to forged element ([daf383a](https://github.com/Lint-Free-Technology/uix/commit/daf383a8dda6e71b9f7eaaf81051e077d18466dd))
* **lock-spark:** Add --uix-lock-icon-background, --uix-lock-icon-border-radius, --uix-lock-icon-padding, and state-variant icon background CSS variables ([#194](https://github.com/Lint-Free-Technology/uix/issues/194)) ([3e2770c](https://github.com/Lint-Free-Technology/uix/commit/3e2770c9e2e9d8fcd84288e3c63cbae45bb83e7a))
* **lock-spark:** add color CSS vars for lock icon and set defaults when target is ha-tile-icon ([#197](https://github.com/Lint-Free-Technology/uix/issues/197)) ([701227b](https://github.com/Lint-Free-Technology/uix/commit/701227b7ca012c42e157aa620d67dd6e051fdd81))
* **lock-spark:** Allow for target to be ha-tile-icon to lock tile icon only ([26dfa91](https://github.com/Lint-Free-Technology/uix/commit/26dfa91e298914dd4ed3003619d7896ddf75612d))
* **lock:** add CSS variable cursor control to lock spark overlay ([#204](https://github.com/Lint-Free-Technology/uix/issues/204)) ([0325409](https://github.com/Lint-Free-Technology/uix/commit/0325409d200626b8dd785692ce127c9100ec607b)), closes [#192](https://github.com/Lint-Free-Technology/uix/issues/192)
* **map-spark:** Add fit_map option to map spark allowing to work around maps in custom cards which may initially hide map (e.g. auto-entities). ([#195](https://github.com/Lint-Free-Technology/uix/issues/195)) ([1a47b91](https://github.com/Lint-Free-Technology/uix/commit/1a47b9145216571ce00d66e423d61cf4c3fa1843))
* **map-spark:** Add map spark tour mode ([#196](https://github.com/Lint-Free-Technology/uix/issues/196)) ([5a6db26](https://github.com/Lint-Free-Technology/uix/commit/5a6db26d21c7c0f881486d6b9ff5f60af6fe6a41))

### 🐞 Bug Fixes

* **beta:** Don't delete entities from config in case locked ([8edf7bd](https://github.com/Lint-Free-Technology/uix/commit/8edf7bdc80dddfdad49b4bdec539918d53b109cc))
* **beta:** Regression with state_color causing configuration error ([598e2cb](https://github.com/Lint-Free-Technology/uix/commit/598e2cbe651ae5f656c862971a09544b33121ff1))
* **forge:** Fix template nesting not resolving correctly ([db6ebce](https://github.com/Lint-Free-Technology/uix/commit/db6ebce26cb01df42b5c9fdb18f523e0d95cd489))

### ⚙️ Miscellaneous

* Add entity card support for auto-entities ([9087bfc](https://github.com/Lint-Free-Technology/uix/commit/9087bfc46a65e1c2c8104419cff66709403c3980))
* **lock-spark:** Adjust top/left lock icon when target is ha-tile-icon ([f9d377f](https://github.com/Lint-Free-Technology/uix/commit/f9d377f86729708c280c9e843ad05b692129e7fc))

## [6.1.0](https://github.com/Lint-Free-Technology/uix/compare/v6.0.0...v6.1.0) (2026-04-08)

### ⭐ New Features

* **forge:** Add Button Spark ([#168](https://github.com/Lint-Free-Technology/uix/issues/168)) ([51cfbe8](https://github.com/Lint-Free-Technology/uix/commit/51cfbe8110eedf6046bebc2259ab29702a8dfd8a)), closes [#166](https://github.com/Lint-Free-Technology/uix/issues/166)
* **forge:** add lock spark for UIX Forge ([#178](https://github.com/Lint-Free-Technology/uix/issues/178)) ([24e2860](https://github.com/Lint-Free-Technology/uix/commit/24e28607505b1703e28ad9bc9128619010c483e9))
* **forge:** add Search Spark for shadow DOM element mutation ([#136](https://github.com/Lint-Free-Technology/uix/issues/136)) ([3343b31](https://github.com/Lint-Free-Technology/uix/commit/3343b316b6dc13a56ded00838366f0cad20d4540))
* **forge:** map spark with memory mode ([#177](https://github.com/Lint-Free-Technology/uix/issues/177)) ([9b60a99](https://github.com/Lint-Free-Technology/uix/commit/9b60a997b98380d11a268482d8bc6722b3cdeb7c)), closes [#176](https://github.com/Lint-Free-Technology/uix/issues/176)
* **forge:** merge forge.macros into uix.macros for forge and forgedElement ([#187](https://github.com/Lint-Free-Technology/uix/issues/187)) ([82c3d0e](https://github.com/Lint-Free-Technology/uix/commit/82c3d0ed62a410104a7b0c7ac08fafa52162ca93))
* **forge:** Resolve `!secret` references in foundry configs ([#184](https://github.com/Lint-Free-Technology/uix/issues/184)) ([13cde4f](https://github.com/Lint-Free-Technology/uix/commit/13cde4f67a91bae718cc613d406e178c825d4998))
* **forge:** support multiple sparks of the same type ([#152](https://github.com/Lint-Free-Technology/uix/issues/152)) ([b0b2b37](https://github.com/Lint-Free-Technology/uix/commit/b0b2b37fa8e443067ea90fe63c27ca4a2845d47a))
* **lock-spark:** add `code_dialog` config to lock spark for customising the PIN/passphrase dialog title, submit_text and cancel_text ([#185](https://github.com/Lint-Free-Technology/uix/issues/185)) ([53c4f90](https://github.com/Lint-Free-Technology/uix/commit/53c4f90c3cb3ffdc1cf367137419d47cb25ef612))
* **lock-spark:** Support confirmation object with title and text in lock spark ([#182](https://github.com/Lint-Free-Technology/uix/issues/182)) ([40b2551](https://github.com/Lint-Free-Technology/uix/commit/40b2551adf87732f5a1181e082b1bd1020974526))
* **macros:** transitively resolve macro dependencies in buildMacros ([#175](https://github.com/Lint-Free-Technology/uix/issues/175)) ([82c55f8](https://github.com/Lint-Free-Technology/uix/commit/82c55f888d5dba71f02e67d70923dd291cece40e))
* **sections:** Support styling section backgrounds by UIX config. ([#149](https://github.com/Lint-Free-Technology/uix/issues/149)) ([b6b1946](https://github.com/Lint-Free-Technology/uix/commit/b6b19464239f86da453a8b3d5a8b6050954deb20))

### 🐞 Bug Fixes

* **event-spark:** event spark events causing all forged elements with event spark to refresh even if forge_id does not match ([54a3202](https://github.com/Lint-Free-Technology/uix/commit/54a3202cb93113715871bc822abc6c58f94bdac5))
* **forge sparks:** centralize spark lifecycle guards - stops growing prepend/append in search spark ([#172](https://github.com/Lint-Free-Technology/uix/issues/172)) ([1fc2446](https://github.com/Lint-Free-Technology/uix/commit/1fc244692ac13bde38d3fbbe42a3f214676d7ee8))
* **forge sparks:** Template updates not applying to sparks after first update ([1704219](https://github.com/Lint-Free-Technology/uix/commit/1704219cbbc5802d3f97c1702e1f0e657f1d42c0))
* **forge:** Add `delayed_hass` forge config option to suppress console errors on load for some custom cards. e.g. apexcharts_card ([8592c12](https://github.com/Lint-Free-Technology/uix/commit/8592c126d517f6db11426547bf9521d0bab5534d))
* **forge:** allow and pass state_color through to forged element in row mold ([#180](https://github.com/Lint-Free-Technology/uix/issues/180)) ([e78a87e](https://github.com/Lint-Free-Technology/uix/commit/e78a87e79e92fc88a00ad73b4b7d5267de76b19e))
* **forge:** Console errors when editing UIX Forge in UI editor ([afebb46](https://github.com/Lint-Free-Technology/uix/commit/afebb467a24290694ddeb1ae58c706becd80c9f7))
* **forge:** Templates in uix in element config cause element not to show due to unfulfilled ready promise ([12e4ac7](https://github.com/Lint-Free-Technology/uix/commit/12e4ac737deb6c6ca212a7c0962c4ea5e2be749e))
* **lock-spark:** prevent overlay continuous updates ([#183](https://github.com/Lint-Free-Technology/uix/issues/183)) ([9073462](https://github.com/Lint-Free-Technology/uix/commit/907346251c5daf36bb610bc5ef9ff924db63448f))
* **lock-spark:** Set lock spark display to block by default and allow override by CSS ([3879182](https://github.com/Lint-Free-Technology/uix/commit/3879182a924924f9aca8d6c8705eff828903f375))
* **lock-spark:** Update icon display to inline-block so --uix-icon-position applies ([37e3175](https://github.com/Lint-Free-Technology/uix/commit/37e3175e6c64d698ebe5dc7e4bc6ed39c967dbf2))
* **toast:** Refactor for timing reliability ([1eb319f](https://github.com/Lint-Free-Technology/uix/commit/1eb319fd310050ae914a7fcae63d6222875b507e))
* **tooltip-spark:** fix flickering of tooltip spark from constant recreation ([#174](https://github.com/Lint-Free-Technology/uix/issues/174)) ([f508bc7](https://github.com/Lint-Free-Technology/uix/commit/f508bc7e73a65ac9bdf2e138ba494cb0f34f20a8))

### 📦 Dependency Upgrades

* bump @babel/preset-env from 7.23.6 to 7.29.2 ([#145](https://github.com/Lint-Free-Technology/uix/issues/145)) ([ecd93ae](https://github.com/Lint-Free-Technology/uix/commit/ecd93ae9fdde7e31becfecdeb6be1f9f5a7b4432))
* bump @rollup/plugin-babel from 6.0.4 to 7.0.0 ([#146](https://github.com/Lint-Free-Technology/uix/issues/146)) ([c8d690e](https://github.com/Lint-Free-Technology/uix/commit/c8d690e5abc7d9cc02b28ddc43e2b7e1a90873a4))
* bump lit from 3.1.0 to 3.3.2 ([#161](https://github.com/Lint-Free-Technology/uix/issues/161)) ([97816ce](https://github.com/Lint-Free-Technology/uix/commit/97816ce60844dd3541c5a4642c0c0289c5045dc7))
* bump rollup from 2.80.0 to 4.60.1 ([#143](https://github.com/Lint-Free-Technology/uix/issues/143)) ([2400e1b](https://github.com/Lint-Free-Technology/uix/commit/2400e1b5d15f0adbd766cab452148ffe125b6961))
* bump rollup-plugin-typescript2 from 0.36.0 to 0.37.0 ([#144](https://github.com/Lint-Free-Technology/uix/issues/144)) ([7475217](https://github.com/Lint-Free-Technology/uix/commit/7475217403aef8132f89e1961fcae4e18126b85f))

### ⚙️ Miscellaneous

* **button-spark:** add `icon` config for icon-only buttons ([#169](https://github.com/Lint-Free-Technology/uix/issues/169)) ([32b52b7](https://github.com/Lint-Free-Technology/uix/commit/32b52b7ef414915a1d1a6f9aebd07c7cf68c85ef))
* **button-spark:** Adjust icon button height and alignment ([70a22b5](https://github.com/Lint-Free-Technology/uix/commit/70a22b539cebf8870fb6ecc57819ce2e82addcc1))
* **button-spark:** style matching Home Assistant icon button when using with icon only ([#170](https://github.com/Lint-Free-Technology/uix/issues/170)) ([ae5fdf0](https://github.com/Lint-Free-Technology/uix/commit/ae5fdf0e72770960d42397f9bb38ebadf2c3e2e1))
* **forge:** Provide action-handler scaffold for for UIX Forge Sparks ([#167](https://github.com/Lint-Free-Technology/uix/issues/167)) ([2d8144e](https://github.com/Lint-Free-Technology/uix/commit/2d8144e077b829f82f22d96a40ad5ef7f056f54d))
* TypeScript 6 build errors and VSCode linting alignment ([#165](https://github.com/Lint-Free-Technology/uix/issues/165)) ([c68b011](https://github.com/Lint-Free-Technology/uix/commit/c68b0110119f126ffd2430a8702b8d1cb594ba4f))

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
