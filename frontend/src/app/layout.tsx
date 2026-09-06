import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { THEME_SCRIPT, ThemeProvider } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/app/service-worker";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "People",
    template: "%s · People",
  },
  description: "People — manage your team, together.",
  // iOS does not read `display` from the manifest; these are what make an
  // installed shortcut open without Safari's chrome around it.
  appleWebApp: {
    capable: true,
    title: "People",
    statusBarStyle: "default",
  },
};

/**
 * Declared here rather than left to the default so the status bar matches the
 * app once it is installed, and so a phone in dark mode does not paint a white
 * strip above a dark page.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without this, env(safe-area-inset-*) reports 0 on every phone and the
  // bottom bar sits under the home indicator once the app is installed. It
  // costs the header a matching top inset, which the /me layout adds.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {/* Applies the remembered theme before the first paint, so the page is
            never briefly the wrong colour.
            
            An inline script as the first child of <body>, which is what
            next-themes does and what React renders in place. `next/script`
            with beforeInteractive is wrong here: React never executes a script
            element it renders on the client, and Next says so in the console.
            A hand-rolled <head> is wrong too — that breaks hydration at the
            <html> element, in production only. The suppression is because this
            node is written by the browser's parser before React sees it. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />

        {/* The palette carries a full dark set, so the choice is the user's.
            Unset means following whatever they told their machine. */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>

        <ServiceWorker />
      </body>
    </html>
  );
}
