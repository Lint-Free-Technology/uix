from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

from playwright.sync_api import Page


REPO_ROOT = Path(__file__).resolve().parent.parent
FORM_HELPER_TS = REPO_ROOT / "src" / "helpers" / "dom" / "ha-form.ts"
FORM_SPARK_TS = REPO_ROOT / "src" / "forge" / "sparks" / "uix-spark-form.ts"


@lru_cache(maxsize=1)
def _transpiled(path: Path) -> str:
    return subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "process.stdout.write(code);"
            ),
            str(path),
        ],
        cwd=REPO_ROOT,
        text=True,
    )


def test_form_config_updates_reconcile_schema_data(page: Page) -> None:
    result = page.evaluate(
        """({ helperSource, sparkSource }) => {
          const helperModule = { exports: {} };
          new Function('require', 'module', 'exports', helperSource)(
            () => { throw new Error('Unexpected helper import'); },
            helperModule,
            helperModule.exports,
          );

          class UixForgeSparkBase {
            constructor(controller, config) {
              this.controller = controller;
              this.config = config;
              this._cancel = [];
              this._callGeneration = 0;
            }
            configUpdated(config) { this.config = config; }
            _beginUpdate() { return ++this._callGeneration; }
          }
          const sparkModule = { exports: {} };
          const require = (name) => {
            if (name === '../../helpers/dom/ha-form') return helperModule.exports;
            if (name === '../../helpers/dom/ensure-element') return {};
            if (name === './uix-spark-base') return { UixForgeSparkBase };
            if (name === 'lit') return {};
            throw new Error(`Unexpected spark import: ${name}`);
          };
          new Function('require', 'module', 'exports', sparkSource)(
            require,
            sparkModule,
            sparkModule.exports,
          );

          const update = (previousSchema, schema, data) => {
            const spark = new sparkModule.exports.UixForgeSparkForm(
              {},
              { after: 'element', schema: previousSchema },
            );
            spark._data = data;
            spark._attach = () => Promise.resolve();
            spark.configUpdated({ after: 'element', schema });
            return spark._data;
          };

          const flattenedNested = [{
            name: 'layout',
            flatten: true,
            schema: [{
              name: 'contact',
              schema: [{ name: 'priority', default: 'normal' }],
            }],
          }];
          return {
            removedField: update(
              [{ name: 'message', default: 'hello' }],
              [{ name: 'note', default: 'draft' }],
              { message: 'saved' },
            ),
            introducedNestedField: update(
              [{ name: 'contact', schema: [{ name: 'priority', default: 'urgent' }] }],
              [{ name: 'delivery', schema: [{ name: 'priority', default: 'normal' }] }],
              { contact: { priority: 'high' } },
            ),
            clearedFlattenedField: update(flattenedNested, flattenedNested, {}),
          };
        }""",
        {"helperSource": _transpiled(FORM_HELPER_TS), "sparkSource": _transpiled(FORM_SPARK_TS)},
    )

    assert result == {
        "removedField": {"note": "draft"},
        "introducedNestedField": {"delivery": {"priority": "normal"}},
        "clearedFlattenedField": {},
    }
