"use client";

import * as React from "react";
import Link from "next/link";

import { AuroraHero } from "@/components/ui";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Users } from "@/components/animate-ui/icons/users";

/**
 * Full-bleed split layout pinned to the viewport: the page itself never
 * scrolls. Below `lg` the artwork drops away and the form takes the whole
 * screen; from `lg` up the two halves sit side by side. Nothing scrolls.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="flex w-full flex-col overflow-hidden px-5 py-6 sm:px-10 sm:py-8 lg:w-1/2 lg:px-14 xl:px-20">
        <header>
          <Slide direction="down" offset={14} delay={60}>
            <AnimateIcon animateOnHover asChild>
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 rounded-lg font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Users size={19} />
                </span>
                <span className="text-lg tracking-tight">People</span>
              </Link>
            </AnimateIcon>
          </Slide>
        </header>

        <main className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <Fade delay={800}>
            <p>© {new Date().getFullYear()} People</p>
          </Fade>
          <Fade delay={850}>
            <nav className="flex items-center gap-5">
              <Link href="#" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="#" className="transition-colors hover:text-foreground">
                Terms
              </Link>
            </nav>
          </Fade>
        </footer>
      </div>

      {/* Right: aurora panel. Decoration only, so it drops below lg. */}
      <div className="relative hidden overflow-hidden border-l border-border lg:block lg:w-1/2">
        <AuroraHero title="People" />
        {/* Thin light catch on the divider so the edge reads intentional. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-px
                     bg-gradient-to-b from-transparent via-primary/40 to-transparent"
        />
      </div>
    </div>
  );
}
