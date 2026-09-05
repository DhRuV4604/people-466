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

  experimental: {
    /**
     * These packages export a large surface from a single entry point, so a
     * named import of one icon or one helper otherwise pulls the whole barrel
     * into the client bundle. Rewriting them to deep imports keeps first load
     * proportional to what a page actually uses.
     */
    optimizePackageImports: ["lucide-react", "radix-ui", "motion", "date-fns"],
  },
};

export default nextConfig;
