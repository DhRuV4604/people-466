"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { DropdownMenuItem } from "@/components/ui/overlays";

type DropdownMenuLinkItemProps = React.ComponentProps<
  typeof DropdownMenuItem
> & {
  href: string;
};

/**
 * A menu entry that navigates. The animated menu item renders its own motion
 * element and consumes `asChild` internally, so it cannot wrap a Link; this
 * routes on select instead, which keeps full keyboard support.
 */
function DropdownMenuLinkItem({
  href,
  onSelect,
  ...props
}: DropdownMenuLinkItemProps) {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // The item's onSelect is typed as a union of the React and DOM
        // events, so the forward is cast to whichever one arrived.
        (onSelect as ((e: typeof event) => void) | undefined)?.(event);
        if (!event.defaultPrevented) router.push(href);
      }}
      {...props}
    />
  );
}

export { DropdownMenuLinkItem, type DropdownMenuLinkItemProps };
