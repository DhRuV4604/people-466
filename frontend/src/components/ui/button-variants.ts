import { cva, type VariantProps } from "class-variance-authority";

/**
 * Every button in the app renders through `Button`, which reads these classes,
 * so height, radius, gap, icon size and focus ring stay identical everywhere.
 *
 * They live apart from the component because `button.tsx` is a client module:
 * a server component that needs to style a link as a button can import from
 * here without pulling the client boundary along with it.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center whitespace-nowrap",
    "rounded-xl font-medium leading-none select-none",
    "outline-none transition-colors",
    "focus-visible:ring-[3px] focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-60",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 [--ripple-button-ripple-color:var(--color-primary-foreground)]",
        outline:
          "border border-input bg-background text-foreground hover:bg-muted/60 [--ripple-button-ripple-color:var(--color-foreground)]",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground [--ripple-button-ripple-color:var(--color-foreground)]",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 [--ripple-button-ripple-color:var(--color-white)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 gap-1.5 px-3 text-sm [&_svg]:size-4",
        md: "h-11 gap-2 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 gap-2 px-4 text-[15px] [&_svg]:size-[18px]",
        icon: "size-11 [&_svg]:size-[18px]",
        "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
