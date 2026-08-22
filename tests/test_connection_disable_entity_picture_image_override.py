from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CONNECTION_TS_PATH = REPO_ROOT / "src" / "coordinator" / "connection.ts"


def test_disable_entity_picture_image_override_setting_and_override() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
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
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const { ConnectionMixin } = moduleObj.exports;"
                "const Mixed = ConnectionMixin(class {});"
                "const inst = new Mixed();"
                "inst._data = { disable_entity_picture_image_override: true };"
                "const fromConfig = inst.disableEntityPictureImageOverride;"
                "inst.setDisableEntityPictureImageOverrideOverride(false);"
                "const fromOverride = inst.disableEntityPictureImageOverride;"
                "inst.setDisableEntityPictureImageOverrideOverride(null);"
                "const afterClear = inst.disableEntityPictureImageOverride;"
                "process.stdout.write(JSON.stringify({ fromConfig, fromOverride, afterClear }));"
            ),
            str(CONNECTION_TS_PATH),
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
