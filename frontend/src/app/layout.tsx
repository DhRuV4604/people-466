import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { THEME_SCRIPT, ThemeProvider } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/toast";

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
            never briefly the wrong colour. `beforeInteractive` hoists it out of
            the React tree into the document itself, which is what keeps it from
            taking part in hydration — a plain <script> here, or a hand-rolled
            <head>, breaks hydration at the <html> element. */}
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>

        {/* The palette carries a full dark set, so the choice is the user's.
            Unset means following whatever they told their machine. */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
