from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

import pytest
from playwright.sync_api import Page


REPO_ROOT = Path(__file__).resolve().parent.parent


@lru_cache(maxsize=1)
def _transpiled_actions() -> str:
    return subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync('src/ll-custom-actions.ts', 'utf8');"
                "const { code } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "process.stdout.write(code);"
            ),
        ],
        cwd=REPO_ROOT,
        text=True,
    )


@pytest.fixture
def popover_page(page: Page) -> Page:
    page.clock.install(time=0)
    page.clock.pause_at(1000)
    page.evaluate(
        """(source) => {
          const base = document.createElement('home-assistant');
          base.attachShadow({ mode: 'open' });
          document.body.append(base);
          window.popovers = [];
          window.dialogs = [];
          window.hassActions = [];
          window.toastNotifications = [];
          window.errors = [];
          console.error = (...args) => window.errors.push(args[0]);
          base.addEventListener('hass-action', ({ detail }) =>
            window.hassActions.push(detail)
          );
          base.addEventListener('hass-notification', ({ detail }) =>
            window.toastNotifications.push(detail)
          );
          base.addEventListener('show-dialog', ({ detail }) => {
            const dialog = document.createElement(detail.dialogTag);
            dialog.params = detail.dialogParams;
            dialog.addEventListener('dialog-closed', event => {
              if (event.detail.dialog === dialog.localName) {
                window.dialogs.splice(window.dialogs.indexOf(dialog), 1);
              }
            });
            window.dialogs.push(dialog);
            base.shadowRoot.append(dialog);
          });

          class Popover extends HTMLElement {
            _open = false;
            openChanges = [];
            get open() { return this._open; }
            set open(value) {
              this._open = value;
              this.openChanges.push(value);
            }
          }
          customElements.define('ha-adaptive-popover', Popover);
          window.loadCardHelpers = async () => ({
            createCardElement: async () => document.createElement('div'),
          });
          const imports = {
            './helpers/hass': {
              hass_base_el: async () => base,
              provideHass: async () => {},
            },
            './helpers/dom/ensure-element': { ensureCustomElement: async () => {} },
            './helpers/dom/ha-button': {
              createHaButton: () => document.createElement('button'),
            },
            './helpers/apply_uix': {},
            './helpers/dom/action-handler': {},
            './helpers/dom/ha-form': {},
            './helpers/lock-access': {},
          };
          const module = { exports: {} };
          new Function('require', 'module', 'exports', source)(
            name => {
              if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
              return imports[name];
            }, module, module.exports,
          );
          window.openPopover = async (data, opened = true) => {
            await module.exports.Actions.popover(
              {
                target: 'none',
                ...('card' in data ? {} : { content: '<span>Controls</span>' }),
                ...data,
              },
              {}, document.body,
            );
            const popover = [...base.shadowRoot.querySelectorAll('ha-adaptive-popover')].at(-1);
            if (!popover) return;
            window.popovers.push(popover);
            if (opened) popover.dispatchEvent(new Event('opened'));
          };
          window.showToast = data => module.exports.Actions.toast(data);

          // Track pending timers to check early-close cleanup without real waits.
          const set = window.setTimeout.bind(window);
          const clear = window.clearTimeout.bind(window);
          window.pendingTimers = new Set();
          window.setTimeout = (callback, delay) => {
            const id = set(() => {
              window.pendingTimers.delete(id);
              callback();
            }, delay);
            window.pendingTimers.add(id);
            return id;
          };
          window.clearTimeout = id => {
            window.pendingTimers.delete(id);
            clear(id);
          };
        }""",
        _transpiled_actions(),
    )
    return page


def test_timeout_closes_only_after_opening(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 20000 }, false)")
    page.clock.run_for(30000)
    assert page.evaluate("popovers[0].open") is True
    assert page.evaluate("pendingTimers.size") == 0
    page.evaluate("popovers[0].dispatchEvent(new Event('opened'))")
    page.clock.run_for(19999)
    assert page.evaluate("popovers[0].open") is True
    page.clock.run_for(1)
    assert page.evaluate("popovers[0].open") is False
    # Let HA complete its closing animation before removing the element.
    assert page.evaluate("popovers[0].isConnected") is True
    page.evaluate("popovers[0].dispatchEvent(new Event('closed'))")
    assert page.evaluate("popovers[0].isConnected") is False
    assert page.evaluate("pendingTimers.size") == 0


def test_toast_forwards_supporting_text_and_icon_action_options(popover_page: Page) -> None:
    page = popover_page
    page.evaluate(
        """showToast({
          message: 'Starting',
          supportingText: 'Some features may not be ready',
          action: {
            icon: 'M0 0',
            keepOpen: true,
            tap_action: { action: 'more-info', entity: 'light.bed_light' },
          },
          secondary_action: {
            text: 'Toggle',
            icon: 'M1 1',
            keepOpen: true,
            tap_action: { action: 'toggle' },
          },
        })"""
    )

    assert page.evaluate(
        """() => {
          const toast = toastNotifications[0];
          return {
            supportingText: toast.supportingText,
            action: {
              icon: toast.action.icon,
              keepOpen: toast.action.keepOpen,
              hasAction: typeof toast.action.action === 'function',
              hasTapAction: 'tap_action' in toast.action,
              hasText: 'text' in toast.action,
            },
            secondaryAction: {
              text: toast.secondaryAction.text,
              icon: toast.secondaryAction.icon,
              keepOpen: toast.secondaryAction.keepOpen,
              hasAction: typeof toast.secondaryAction.action === 'function',
              hasTapAction: 'tap_action' in toast.secondaryAction,
            },
          };
        }"""
    ) == {
        "supportingText": "Some features may not be ready",
        "action": {
            "icon": "M0 0",
            "keepOpen": True,
            "hasAction": True,
            "hasTapAction": False,
            "hasText": False,
        },
        "secondaryAction": {
            "text": "Toggle",
            "icon": "M1 1",
            "keepOpen": True,
            "hasAction": True,
            "hasTapAction": False,
        },
    }

    page.evaluate("toastNotifications[0].action.action()")
    page.evaluate("toastNotifications[0].secondaryAction.action()")
    assert page.evaluate("hassActions.map(({ detail }) => detail.config.tap_action)") == [
        {"action": "more-info", "entity": "light.bed_light"},
        {"action": "toggle"},
    ]


def test_toast_resolves_named_icons_and_falls_back_on_failure(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("""() => {
      customElements.define('ha-icon', class extends HTMLElement {
        connectedCallback() {
          const svg = document.createElement('ha-svg-icon');
          this.attachShadow({ mode: 'open' }).append(svg);
          if (this.icon === 'mdi:lightbulb') {
            setTimeout(() => { svg.path = 'M2 3'; }, 100);
          }
          if (this.icon === 'custom:lamp') {
            setTimeout(() => { svg.path = 'M4 5'; }, 100);
          }
          if (this.icon === 'custom:layered') {
            setTimeout(() => { svg.path = 'M6 7'; svg.secondaryPath = 'M8 9'; }, 100);
          }
        }
      });
      window.toastPromise = showToast({
        message: 'Test',
        action: { icon: 'mdi:lightbulb', text: 'Toggle' },
        secondary_action: { icon: 'mdi:missing' },
      });
      window.customToastPromise = showToast({
        message: 'Custom',
        action: { icon: 'custom:lamp', text: 'Lamp' },
        secondary_action: { icon: 'custom:layered', text: 'Layered' },
      });
    }""")
    page.clock.run_for(2100)
    page.evaluate("toastPromise")
    page.evaluate("customToastPromise")
    assert page.evaluate("toastNotifications.find(t => t.message === 'Test').action.icon") == "M2 3"
    assert page.evaluate("toastNotifications.find(t => t.message === 'Test').secondaryAction.icon") is None
    assert page.evaluate("toastNotifications.find(t => t.message === 'Test').secondaryAction.text") == "mdi:missing"
    assert page.evaluate("toastNotifications.find(t => t.message === 'Custom').action.icon") == "M4 5"
    assert page.evaluate("toastNotifications.find(t => t.message === 'Custom').secondaryAction.icon") is None
    assert page.evaluate("toastNotifications.find(t => t.message === 'Custom').secondaryAction.text") == "Layered"
    assert page.evaluate("document.querySelectorAll('home-assistant > ha-icon').length") == 0
    assert page.evaluate("pendingTimers.size") == 0


@pytest.mark.parametrize("data", [{}, {"timeout": 0}, {"timeout": None}])
def test_no_timeout_keeps_existing_behavior(popover_page: Page, data: dict) -> None:
    page = popover_page
    page.evaluate("data => openPopover(data)", data)
    page.clock.run_for(60000)
    assert page.evaluate("popovers[0].open") is True
    assert page.evaluate("pendingTimers.size") == 0
    page.evaluate("popovers[0].dispatchEvent(new Event('closed'))")
    assert page.evaluate("popovers[0].isConnected") is False


@pytest.mark.parametrize("timeout", [-1, 0.5, "20000", True, {}, 2147483648])
def test_invalid_timeout_is_rejected(popover_page: Page, timeout: object) -> None:
    page = popover_page
    page.evaluate("timeout => openPopover({ timeout })", timeout)
    assert page.evaluate("popovers.length") == 0
    assert page.evaluate("pendingTimers.size") == 0
    assert page.evaluate("errors") == [
        "UIX: popover timeout must be an integer from 0 to 2147483647 milliseconds:"
    ]


@pytest.mark.parametrize("timeout", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_timeout_is_rejected(popover_page: Page, timeout: str) -> None:
    page = popover_page
    page.evaluate("value => openPopover({ timeout: Number(value) })", timeout)
    assert page.evaluate("popovers.length") == 0
    assert page.evaluate("errors.length") == 1


def test_manual_close_cancels_timer_before_reopening(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 })")
    page.clock.run_for(5000)
    page.evaluate("popovers[0].dispatchEvent(new Event('closed'))")
    assert page.evaluate("pendingTimers.size") == 0
    page.evaluate("openPopover({ timeout: 20000 })")
    page.clock.run_for(5000)
    assert page.evaluate("popovers.map(p => p.openChanges)") == [[True], [True]]
    page.clock.run_for(15000)
    assert page.evaluate("popovers[1].open") is False


def test_popovers_have_independent_timers(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 })")
    page.evaluate("openPopover({ timeout: 20000 })")
    page.clock.run_for(10000)
    assert page.evaluate("popovers.map(p => p.open)") == [False, True]
    page.clock.run_for(10000)
    assert page.evaluate("popovers.map(p => p.open)") == [False, False]


def test_nested_events_do_not_start_or_cancel_parent_timer(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 }, false)")
    page.evaluate("""() => {
      const child = popovers[0].firstElementChild;
      child.dispatchEvent(new Event('opened', { bubbles: true }));
      child.dispatchEvent(new Event('closed', { bubbles: true }));
    }""")
    assert page.evaluate("popovers[0].isConnected") is True
    assert page.evaluate("pendingTimers.size") == 0
    page.evaluate("popovers[0].dispatchEvent(new Event('opened'))")
    page.clock.run_for(5000)
    page.evaluate("""() => {
      popovers[0].firstElementChild.dispatchEvent(new Event('opened', { bubbles: true }));
      popovers[0].firstElementChild.dispatchEvent(new Event('closed', { bubbles: true }));
    }""")
    page.clock.run_for(5000)
    assert page.evaluate("popovers[0].open") is False


def test_close_before_opening_removes_pending_listener(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 }, false)")
    page.evaluate("""() => {
      popovers[0].dispatchEvent(new Event('closed'));
      popovers[0].dispatchEvent(new Event('opened'));
    }""")
    assert page.evaluate("pendingTimers.size") == 0


def test_timeout_also_closes_nondismissible_popover(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("""openPopover({
      timeout: 10000, dismissible: false, buttons: { secondary: { label: 'Close' } },
    })""")
    page.clock.run_for(10000)
    assert page.evaluate("popovers[0].open") is False
    assert page.evaluate("errors") == []


def test_card_content_can_use_timeout(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000, card: { type: 'tile' } })")
    assert page.evaluate("popovers[0].querySelector('.uix-popover-card') !== null") is True
    page.clock.run_for(10000)
    assert page.evaluate("popovers[0].open") is False


def test_removing_popover_does_not_change_detached_element(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 })")
    page.evaluate("popovers[0].remove()")
    page.clock.run_for(10000)
    assert page.evaluate("popovers[0].openChanges") == [True]
    assert page.evaluate("pendingTimers.size") == 0


def test_dialog_manager_can_close_nested_popovers_in_order(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ title: 'Outer' })")
    page.evaluate("openPopover({ title: 'Inner' })")
    assert page.evaluate("new Set(dialogs.map(dialog => dialog.localName)).size") == 2
    assert page.evaluate("dialogs.at(-1).closeDialog()") is True
    assert page.evaluate("popovers.map(popover => popover.open)") == [True, False]
    page.evaluate("popovers[1].dispatchEvent(new Event('closed'))")
    assert page.evaluate("dialogs.length") == 1
    assert page.evaluate("dialogs[0].closeDialog()") is True
    page.evaluate("popovers[0].dispatchEvent(new Event('closed'))")
    assert page.evaluate("dialogs.length") == 0


def test_timed_close_releases_dialog_tag(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("openPopover({ timeout: 10000 })")
    tag = page.evaluate("dialogs[0].localName")
    page.clock.run_for(10000)
    page.evaluate("popovers[0].dispatchEvent(new Event('closed'))")
    assert page.evaluate("dialogs.length") == 0
    page.evaluate("openPopover({})")
    assert page.evaluate("dialogs[0].localName") == tag


def test_dialog_manager_respects_nondismissible_popover(popover_page: Page) -> None:
    page = popover_page
    page.evaluate("""openPopover({
      dismissible: false, buttons: { primary: { label: 'Close' } },
    })""")
    page.evaluate("history.replaceState({ dialog: dialogs[0].localName }, '')")
    history_length = page.evaluate("history.length")
    assert page.evaluate("dialogs[0].closeDialog()") is False
    assert page.evaluate("popovers[0].open") is True
    assert page.evaluate("history.length") == history_length


def test_dialog_manager_allows_navigation_while_nondismissible_popover_closes(
    popover_page: Page,
) -> None:
    page = popover_page
    page.evaluate("""openPopover({
      dismissible: false, buttons: { primary: { label: 'Close' } },
    })""")
    page.evaluate("popovers[0].open = false")
    assert page.evaluate("dialogs[0].closeDialog()") is True


def test_rejected_back_restores_dialog_history_for_nested_popover(
    popover_page: Page,
) -> None:
    page = popover_page
    page.evaluate("openPopover({ title: 'Outer' })")
    page.evaluate("""openPopover({
      title: 'Inner', dismissible: false, buttons: { primary: { label: 'Close' } },
    })""")
    inner_tag = page.evaluate("dialogs[1].localName")
    result = page.evaluate("""() => new Promise(resolve => {
      history.replaceState({ opensDialog: true }, '');
      history.pushState({ dialog: dialogs[1].localName }, '');
      window.addEventListener('popstate', event => {
        const closed = dialogs[1].closeDialog();
        resolve({ closed, consumed: event.state, restored: history.state });
      }, { once: true });
      history.back();
    })""")
    assert result == {
        "closed": False,
        "consumed": {"opensDialog": True},
        "restored": {"dialog": inner_tag},
    }
    assert page.evaluate("popovers.map(popover => popover.open)") == [True, True]


def test_dialog_manager_releases_disconnected_nondismissible_popover(
    popover_page: Page,
) -> None:
    page = popover_page
    page.evaluate("openPopover({ title: 'Outer' })")
    page.evaluate("""openPopover({
      title: 'Inner', dismissible: false, timeout: 10000,
      buttons: { primary: { label: 'Close' } },
    })""")
    inner_tag = page.evaluate("dialogs[1].localName")
    page.evaluate("popovers[1].remove()")
    page.evaluate("history.replaceState({ opensDialog: true }, '')")

    assert page.evaluate("dialogs[1].closeDialog()") is True
    assert page.evaluate("dialogs.length") == 1
    assert page.evaluate("popovers[0].open") is True
    assert page.evaluate("popovers[1].openChanges") == [True]
    assert page.evaluate("pendingTimers.size") == 0
    assert page.evaluate("history.state") == {"opensDialog": True}

    page.evaluate("openPopover({ title: 'Replacement' })")
    assert page.evaluate("dialogs[1].localName") == inner_tag
