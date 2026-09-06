import type { MetadataRoute } from "next";

/**
 * What a phone needs to keep this on a home screen.
 *
 * `start_url` is the employee space rather than the root: someone installing
 * this to a phone is an employee checking in and reading payslips, not an
 * administrator running payroll — and the root would send most of them
 * straight there anyway.
 *
 * `display: standalone` drops the browser chrome, which is what makes the
 * bottom nav bar reachable by a thumb instead of sitting above Safari's own
 * toolbar.
 *
 * The icons are real files at the sizes they claim. They used to all be
 * `/People.png`, a 1262px logo declared as 192 and 512: iOS took it, and
 * Chrome — which decodes the icon and checks it against the manifest before
 * offering to install — was within its rights not to. The maskable one is a
 * separate file because Android crops that shape to the launcher's mask, and
 * the bare logo lost its edges to a circle.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pins the app's identity, so a later change to start_url updates the
    // installed app instead of installing a second copy beside it.
    id: "/me",
    name: "PeoplePay360",
    short_name: "People",
    description: "Check in, request leave, and read your payslips.",
    start_url: "/me",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the page background so the splash does not flash white before
    // the first paint.
    background_color: "#ffffff",
    theme_color: "#6d28d9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
