import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import { babel } from "@rollup/plugin-babel"; 

const dev = process.env.ROLLUP_WATCH;

const tsPluginOptions = {
  include: ["**/*.ts", "**/*.tsx"],
  exclude: ["**/*.d.ts"],
};

export default {
  input: "tests/test-custom-card/src/my-awesome-card.ts",
  output: {
    file: "tests/test-custom-card/dist/my-awesome-card.js",
    format: "es",
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    json(),
    esbuild({ // 2. Replace typescript() with esbuild()
      minify: !dev,
      target: 'es2017',
      tsconfig: './tsconfig.json'
    }),
    babel({ 
      presets: [["@babel/preset-env", { modules: false }, "@babel/preset-typescript"]], 
      babelHelpers: "bundled",
      extensions: [".js", ".jsx", ".ts", ".tsx"] // Ensure it targets TS files
    }),
  ],
};
