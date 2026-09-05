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
      </body>
    </html>
  );
}
