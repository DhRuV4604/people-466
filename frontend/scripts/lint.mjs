/**
 * Runs ESLint with this workspace's own node_modules on the resolution path.
 *
 * `next` installs here rather than at the repository root — it pins a postcss
 * version the rest of the tree does not share, so npm nests it — while
 * `eslint-config-next` hoists to the root. From there its `require('next/...')`
 * for the parser cannot see `next`, and linting dies before it reads a file.
 * NODE_PATH bridges the two without pinning anyone's dependency versions.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const here = import.meta.dirname;
const result = spawnSync("eslint", process.argv.slice(2), {
  cwd: path.join(here, ".."),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_PATH: path.join(here, "..", "node_modules") },
});

process.exit(result.status ?? 1);
