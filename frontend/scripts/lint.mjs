/**
 * Runs ESLint with this workspace's own node_modules on the resolution path.
 *
 * `next` installs here rather than at the repository root — it pins a postcss
 * version the rest of the tree does not share, so npm nests it — while
 * `eslint-config-next` hoists to the root. From there its `require('next/...')`
 * for the parser cannot see `next`, and linting dies before it reads a file.
 * NODE_PATH bridges the two without pinning anyone's dependency versions.
 *
 * The binary is resolved rather than looked up on PATH, so this works when run
 * directly as well as through an npm script.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const workspace = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

// eslint's package entry sits beside its bin script, wherever npm put it.
const eslintBin = path.join(
  path.dirname(require.resolve("eslint/package.json")),
  "bin",
  "eslint.js",
);

const result = spawnSync(process.execPath, [eslintBin, ...process.argv.slice(2)], {
  cwd: workspace,
  stdio: "inherit",
  env: { ...process.env, NODE_PATH: path.join(workspace, "node_modules") },
});

process.exit(result.status ?? 1);
