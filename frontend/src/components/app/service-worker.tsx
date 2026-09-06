"use client";

import * as React from "react";

/**
 * Registers the service worker, which is what makes Android offer to install
 * the app. iOS needs only the manifest and the apple-touch-icon, so this is
 * purely for Chrome's installability check.
 *
 * The worker caches nothing — see public/sw.js for why.
 */
export function ServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration failing is not worth telling anyone about: the app works
    // exactly the same, it simply cannot be installed to a home screen.
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
