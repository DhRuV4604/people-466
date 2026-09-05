"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

type IconButtonProps = Omit<
  ButtonProps,
  "children" | "startIcon" | "endIcon" | "loadingText" | "size" | "fullWidth"
> & {
  /** The icon to render. Sized by the button, so pass it without size classes. */
  icon: React.ReactNode;
  /** Accessible name. Required, because the button has no visible label. */
  label: string;
  size?: "sm" | "md";
};

/**
 * A square button holding a single icon. Same base as `Button`, so focus ring,
 * radius and icon sizing match the rest of the library.
 */
function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size === "sm" ? "icon-sm" : "icon"}
      startIcon={icon}
      {...props}
    />
  );
}

export { IconButton, type IconButtonProps };
