import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The product mark.
 *
 * One component rather than the same markup in the sidebar and on the sign-in
 * screen, so the logo is replaced in one place. The file already carries its
 * own rounded purple ground, so nothing here paints a background behind it —
 * doing that put a purple square inside a purple square.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/People.png"
      alt=""
      width={size}
      height={size}
      // Decorative: every place this appears sits beside the product name, so
      // a screen reader announcing it twice helps nobody.
      aria-hidden
      priority
      className={cn("shrink-0 rounded-[22%]", className)}
      style={{ width: size, height: size }}
    />
  );
}
