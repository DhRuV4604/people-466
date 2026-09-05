"use client";

import * as React from "react";

import {
  RippleButton,
  RippleButtonRipples,
  type RippleButtonProps,
} from "@/components/animate-ui/primitives/buttons/ripple";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { LoaderCircle } from "@/components/animate-ui/icons/loader-circle";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Every button in the app renders through this component so that height,
 * radius, gap, icon size and focus ring stay identical everywhere. Icons are
 * passed as `startIcon` / `endIcon` rather than as children, which keeps them
 * on the flex baseline.
 *
 * Note: do not run `shadcn add -o` for anything that depends on the registry's
 * own `button` item, it will overwrite this file.
 */

type ButtonProps = Omit<RippleButtonProps, "children" | "asChild"> &
  ButtonVariantProps & {
    children?: React.ReactNode;
    /** Icon rendered before the label. Replaced by the spinner while loading. */
    startIcon?: React.ReactNode;
    /** Icon rendered after the label. Hidden while loading. */
    endIcon?: React.ReactNode;
    loading?: boolean;
    /** Label to show instead of `children` while loading. */
    loadingText?: string;
  };

function Button({
  className,
  variant,
  size,
  fullWidth,
  children,
  startIcon,
  endIcon,
  loading = false,
  loadingText,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <RippleButton
      type={type}
      data-slot="button"
      data-loading={loading || undefined}
      disabled={disabled || loading}
      hoverScale={1.01}
      tapScale={0.99}
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      {...props}
    >
      {loading ? (
        <AnimateIcon animate loop>
          <LoaderCircle aria-hidden />
        </AnimateIcon>
      ) : (
        startIcon
      )}
      {children != null && (
        <span>{loading && loadingText ? loadingText : children}</span>
      )}
      {!loading && endIcon}
      <RippleButtonRipples />
    </RippleButton>
  );
}

export { Button, buttonVariants, type ButtonProps };
