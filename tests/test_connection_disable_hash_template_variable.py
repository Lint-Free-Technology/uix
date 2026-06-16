from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CONNECTION_TS = REPO_ROOT / "src" / "coordinator" / "connection.ts"


def test_disable_hash_template_variable_setting_and_override() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const ts = require('typescript');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { outputText } = ts.transpileModule(source, {"
                "  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/hass') {"
                "    return {"
                "      hass: async () => ({ connection: {} }),"
                "      provideHass: () => {}"
                "    };"
                "  }"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { ConnectionMixin } = moduleObj.exports;"
                "const Mixed = ConnectionMixin(class {});"
                "const inst = new Mixed();"
                "inst._data = { disable_hash_template_variable: true };"
                "const fromConfig = inst.disableHashTemplateVariable;"
                "inst.setDisableHashTemplateVariableOverride(false);"
                "const fromOverride = inst.disableHashTemplateVariable;"
                "inst.setDisableHashTemplateVariableOverride(null);"
                "const afterClear = inst.disableHashTemplateVariable;"
                "process.stdout.write(JSON.stringify({ fromConfig, fromOverride, afterClear }));"
            ),
            str(CONNECTION_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result == {
        "fromConfig": True,
        "fromOverride": False,
        "afterClear": True,
    }
