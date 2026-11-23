"""Lock-access action dispatch tests."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
LOCK_ACCESS_TS = REPO_ROOT / "src" / "helpers" / "lock-access.ts"


def test_wrong_code_dispatches_retry_and_failure_actions() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.CustomEvent = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };"
                "global.window = { loadCardHelpers: async () => ({ showEnterCodeDialog: async () => 'wrong', showAlertDialog: async () => {} }) };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "const module = { exports: {} };"
                "new Function('require', 'module', 'exports', code)(name => {"
                "  if (name === './common/parse-duration') return { parseDuration: () => 0 };"
                "  if (name === './browser_id') return { BrowserID: () => 'wall-tablet' };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "}, module, module.exports);"
                "const actions = [];"
                "const anchor = { dispatchEvent: event => actions.push(event.detail.config.tap_action) };"
                "const config = { locks: [{ code: 1234, users: ['Dev'], max_retries: 2, retry_action: { action: 'perform-action', perform_action: 'persistent_notification.create', data: { title: 'Retry', user: '$uix.user', retry: '$uix.retry', browser: '$uix.browser', nested: { user_id: '$uix.user.id' } } }, failed_action: { action: 'perform-action', perform_action: 'persistent_notification.create', data: { title: 'Failed', retry: '$uix.retry.count', is_admin: '$uix.user.is_admin', browser_id: '$uix.browser_id' } } }] };"
                "(async () => {"
                "  const retryState = module.exports.createLockRetryState();"
                "  await module.exports.requestLockAccess({ config, user: { id: 'abc123', name: 'Dev', is_admin: false }, anchor, retryState });"
                "  await module.exports.requestLockAccess({ config, user: { id: 'abc123', name: 'Dev', is_admin: false }, anchor, retryState });"
                "  process.stdout.write(JSON.stringify(actions));"
                "})().catch(error => { console.error(error); process.exit(1); });"
            ),
            str(LOCK_ACCESS_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    actions = json.loads(output)
    assert actions == [
        {
            "action": "perform-action",
            "perform_action": "persistent_notification.create",
            "data": {"title": "Retry", "user": "Dev", "retry": 1, "browser": "wall-tablet", "nested": {"user_id": "abc123"}},
        },
        {
            "action": "perform-action",
            "perform_action": "persistent_notification.create",
            "data": {"title": "Retry", "user": "Dev", "retry": 2, "browser": "wall-tablet", "nested": {"user_id": "abc123"}},
        },
        {
            "action": "perform-action",
            "perform_action": "persistent_notification.create",
            "data": {"title": "Failed", "retry": 2, "is_admin": False, "browser_id": "wall-tablet"},
        },
    ]
