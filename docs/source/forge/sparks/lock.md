---
description: Learn about the lock spark for UIX Forge — add interactive lock overlays to any element inside a UIX Forge element to protect it with a PIN, passphrase, or confirmation dialog.
icon: material/lock
---
# :material-lock: Lock spark

The `lock` spark overlays a lock icon on any element inside a [UIX Forge](../index.md) forged element. While locked, all pointer interactions with the underlying element are blocked. The user unlocks it via a tap, hold, or double-tap, which can require a PIN code, a text passphrase, or a simple confirmation. After a configurable `duration` the overlay automatically re-locks.

All dialogs are rendered by Home Assistant's own dialog system (via `cardHelpers`), so they integrate natively with the HA frontend:

- Numeric codes → HA numpad dialog (`showEnterCodeDialog`).
- Text passphrases → HA password-field dialog (`showEnterCodeDialog`).
- Confirmation prompts → HA confirmation dialog (`showConfirmationDialog`).
- Wrong-code feedback → HA alert dialog (`showAlertDialog`).

---

## Basic usage

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: lock
      locks:
        - code: 1234
element:
  type: tile
  entity: light.bed_light
```

---

## Targeting specific elements with `for`

Like other sparks, `for` accepts the same [DOM navigation syntax](../../concepts/dom.md) as UIX styles, including `$` to cross shadow-root boundaries.

```yaml
# Lock just the entity-row toggle
- type: lock
  for: "$ hui-generic-entity-row $ ha-entity-toggle"
  locks:
    - code: 1234
```

---

## Lock-matching logic

`locks` is an ordered list. The **first matching entry** determines what the current user must do to unlock. An entry matches according to these rules:

| Configuration | Who it matches |
|---|---|
| `users` list present | Users whose name is in the list. If `admins: true`, also admins. |
| No `users` list + `admins: true` | Admins only. |
| No `users` list + `admins` unset/false | All non-admin users not in the `except` list. |

When an entry has `active: false`, matched users are **not locked** (the overlay is hidden for them).  
When no entry matches:

- `permissive: true` → element is accessible (no overlay shown).
- `permissive: false` (default) → element is permanently blocked with no unlock path.

---

## Configuration reference

### Top-level keys

| Key | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | Must be `lock`. |
| `for` | string | `element` | UIX selector for the element to overlay. Default targets the root of the forged element. |
| `action` | string | `tap` | Gesture that triggers the unlock flow. One of `tap`, `hold`, `double_tap`. |
| `duration` | number | `3000` | Milliseconds before the overlay re-locks after a successful unlock. |
| `icon_locked` | string | `mdi:lock` | MDI icon shown when locked. |
| `icon_unlocked` | string | `mdi:lock-open-variant` | MDI icon shown briefly when unlocked. |
| `icon_locked_color` | string | `--error-color` | CSS colour for the locked icon. |
| `icon_unlocked_color` | string | `--success-color` | CSS colour for the unlocked icon. |
| `permissive` | boolean | `false` | When `true`, elements are accessible if no lock entry matches the current user. |
| `entity` | string | — | Entity ID used when `unlock_action` is a plain HA action. |
| `unlock_action` | object | — | Action to execute immediately after a successful unlock. |
| `locks` | list | `[]` | Ordered list of lock entries (see below). |

### `unlock_action`

| Value | Effect |
|---|---|
| `action: element_tap` | Fires the forged element's `tap_action`. |
| `action: element_hold` | Fires the forged element's `hold_action`. |
| `action: element_double_tap` | Fires the forged element's `double_tap_action`. |
| Any HA action object | Dispatches that action against `entity` (e.g. `action: toggle`). |

### Lock entry keys

| Key | Type | Default | Description |
|---|---|---|---|
| `active` | boolean | `true` | Set to `false` to explicitly unlock for matched users (no overlay). |
| `code` | string or number | — | Code to enter. Numeric values display the HA numpad; text values display a password field. |
| `pin` | string or number | — | Alias for `code`. |
| `confirmation` | string or boolean | — | Confirmation prompt. Pass `true` for HA's default localised text, or a custom string. |
| `users` | list of strings | — | Usernames this entry applies to. |
| `admins` | boolean | `false` | When `true` with no `users` list: admin-only entry. When `true` with a `users` list: entry also applies to admins. |
| `except` | list of strings | — | Users exempt from this entry (only used when no `users` list). |
| `retry_delay` | number | — | Milliseconds to wait between code attempts after a wrong entry. |
| `max_retries` | number | — | Maximum consecutive wrong attempts before the extended delay kicks in. |
| `max_retries_delay` | number | `30000` | Milliseconds to lock out after `max_retries` wrong attempts. |

---

## Examples

### Same PIN for everyone (including admins)

Use two entries — one admin-targeted (`admins: true`, no `users` list) and one that covers all non-admin users — with the same code:

```yaml
locks:
  - code: 1234
    admins: true   # matches admins only (no users list + admins: true)
  - code: 1234     # matches all non-admin users
```

### No lock for admins (default) and a specific user

```yaml
locks:
  - active: false
    users:
      - user1
  - code: 1234
```

### Confirmation only for admins, PIN + confirmation for other users

```yaml
locks:
  - admins: true
    confirmation: true
  - code: 1234
    confirmation: true
```

### Different PINs per user group

```yaml
locks:
  - admins: true
    pin: 9876
  - users:
      - jim
      - alison
    code: 1234
  - users:
      - john
      - jane
    code: 4567
```

### Locked for specific users only (`permissive: true`)

```yaml
permissive: true
locks:
  - users:
      - jim
      - alison
    code: 1234
```

### Tile card: execute hold_action on unlock

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: lock
      unlock_action:
        action: element_hold
      locks:
        - code: 1234
element:
  type: tile
  entity: light.bed_light
  hold_action:
    action: toggle
```

### Tile card: toggle entity directly on unlock

```yaml
type: custom:uix-forge
forge:
  mold: card
  sparks:
    - type: lock
      entity: light.bed_light
      unlock_action:
        action: toggle
      locks:
        - code: 1234
element:
  type: tile
  entity: light.bed_light
```

### Lock the row toggle in an entities card

```yaml
type: custom:uix-forge
forge:
  mold: row
  sparks:
    - type: lock
      for: "$ hui-generic-entity-row $ ha-entity-toggle"
      locks:
        - code: 1234
element:
  type: toggle
  entity: switch.my_switch
```

---

## Customising the overlay appearance

The lock overlay respects a set of CSS custom properties. Set these on the forged element's `uix.style` (or in a theme) to customise the look:

| CSS variable | Default | Description |
|---|---|---|
| `--uix-lock-z-index` | `10` | Stack order of the overlay. |
| `--uix-lock-background` | `transparent` | Background colour of the overlay. |
| `--uix-lock-border-radius` | `inherit` | Border radius of the overlay (inherits the target's). |
| `--uix-lock-icon-size` | `24px` | Size of the lock icon. |

---

## Templates

Like all spark config, `locks` entries are processed as Jinja2 templates, so you can make `active` conditional:

```yaml
- type: lock
  locks:
    - active: "{{ is_state('input_boolean.lock_enabled', 'on') }}"
      code: 1234
```

!!! tip
    Use the [`uix_forge_path()`](../../concepts/dom.md#uix_forge_path0-forge-helper) helper in your browser DevTools console to find the right `for` selector for any element you want to lock.
