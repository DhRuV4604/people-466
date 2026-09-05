import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * These packages export a large surface from a single entry point, so a
     * named import of one icon or one helper otherwise pulls the whole barrel
     * into the client bundle. Rewriting them to deep imports keeps first load
     * proportional to what a page actually uses.
     */
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "motion",
      "date-fns",
      "@base-ui-components/react",
    ],
  },
};

export default nextConfig;
