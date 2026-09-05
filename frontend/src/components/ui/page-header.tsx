"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A link back up one level, sitting above the page title. Breadcrumbs say
 * where you are; this is the one-click way out, and it names the destination
 * rather than saying "Back".
 */
function BackLink({
  href,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      data-slot="back-link"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground",
        "transition-colors outline-none hover:text-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons and other controls, right-aligned on wide screens. */
  actions?: React.ReactNode;
  /** Rendered above the title, typically a BackLink. */
  above?: React.ReactNode;
  className?: string;
};

function PageHeader({
  title,
  description,
  actions,
  above,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {above}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
          {title}
        </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export { BackLink, PageHeader, type PageHeaderProps };
