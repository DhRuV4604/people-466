import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Bundles the server and only the modules it actually reaches into
   * `.next/standalone`, so the runtime image carries no node_modules tree and
   * no build toolchain.
   */
  output: "standalone",

  /**
   * File tracing starts at the repository root rather than this directory,
   * because `@peoplepay360/shared` is a sibling workspace: without this, Next
   * traces from `frontend/` and leaves the shared package out of the bundle.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
};

export default nextConfig;
