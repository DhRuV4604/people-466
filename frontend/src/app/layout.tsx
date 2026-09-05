import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      <head>
        {/* Applies the remembered theme before the first paint, so the page is
            never briefly the wrong colour. It sits in the head rather than the
            React tree, which is what keeps it out of hydration. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {/* The palette carries a full dark set, so the choice is the user's.
            Unset means following whatever they told their machine. */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
