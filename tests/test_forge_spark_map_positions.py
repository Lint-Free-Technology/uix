from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

import pytest
from playwright.sync_api import Page


REPO_ROOT = Path(__file__).resolve().parent.parent
MAP_SPARK_TS = REPO_ROOT / "src" / "forge" / "sparks" / "uix-spark-map.ts"


@lru_cache(maxsize=1)
def _transpiled_map_spark() -> str:
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
            str(MAP_SPARK_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )


@pytest.mark.parametrize("control", ["tour", "slider", "filter"])
@pytest.mark.parametrize(
    ("position", "grouped", "bottom", "right"),
    [
        (None, True, "40px", "10px"),
        ({"bottom": "40px", "right": "10px"}, True, "40px", "10px"),
        ({"bottom": 40, "right": 10}, True, "40px", "10px"),
        ({"bottom": "10px", "right": "10px"}, False, "10px", "10px"),
        ({"bottom": 10, "right": 10}, False, "10px", "10px"),
        ({"bottom": "20px", "right": "30px"}, False, "20px", "30px"),
    ],
)
def test_map_control_position(
    page: Page, control: str, position: dict | None, grouped: bool, bottom: str, right: str
) -> None:
    page.set_content('<div id="map" style="position: relative; width: 500px; height: 400px"></div>')
    result = page.evaluate(
        """({ source, control, position }) => {
          const module = { exports: {} };
          const require = (name) => {
            if (name === './uix-spark-base') return { UixForgeSparkBase: class {} };
            if (name === '../../helpers/common/parse-duration') return {};
            if (name === 'lit') return {};
            throw new Error(`Unexpected module import: ${name}`);
          };
          new Function('require', 'module', 'exports', source)(require, module, module.exports);
          const spark = Object.create(module.exports.UixForgeSparkMap.prototype);
          const map = document.querySelector('#map');
          spark._getMapContainer = () => map;
          const element = document.createElement('div');
          element.style.position = 'absolute';
          let parsed;
          if (control === 'tour') {
            parsed = spark._parseTourIconPosition(position);
            spark._tourIconPosition = parsed;
            spark._applyTourButtonPosition(element);
          } else if (control === 'slider') {
            parsed = spark._parseSliderPosition(position);
            spark._hoursToShowConfig = { position: parsed };
            spark._applySliderPosition(element);
          } else {
            parsed = spark._parseEntityFilterPosition(position);
            spark._entityFilterConfig = { position: parsed };
            spark._applyEntityFilterPosition(element);
          }
          spark._mountBottomRightControl(element, '1', parsed, {});
          const grouped = element.parentElement.classList.contains('uix-map-controls-bottom-right');
          const style = getComputedStyle(grouped ? element.parentElement : element);
          return {
            grouped,
            bottom: style.bottom,
            right: style.right,
            position: getComputedStyle(element).position,
          };
        }""",
        {"source": _transpiled_map_spark(), "control": control, "position": position},
    )

    assert result == {
        "grouped": grouped,
        "bottom": bottom,
        "right": right,
        "position": "static" if grouped else "absolute",
    }
