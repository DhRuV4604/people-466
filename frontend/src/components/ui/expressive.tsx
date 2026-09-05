"use client";

/**
 * Expressive components: buttons and blocks whose whole point is the motion.
 * They are deliberately kept apart from the workhorse `Button`, because a
 * screen should use at most one of them. Reach for these on marketing surfaces
 * and empty states, not inside forms and tables.
 */

// Buttons
export { CopyButton } from "@/components/animate-ui/components/buttons/copy";
export {
  FlipButton,
  FlipButtonFront,
  FlipButtonBack,
} from "@/components/animate-ui/components/buttons/flip";
export { LiquidButton } from "@/components/animate-ui/components/buttons/liquid";
export { GitHubStarsButton } from "@/components/animate-ui/components/buttons/github-stars";
export { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
export {
  RippleButton,
  RippleButtonRipples,
} from "@/components/animate-ui/components/buttons/ripple";
// Renamed: our own `IconButton` is the one screens should use. This is the
// Animate UI original, which bursts particles on click.
export { IconButton as ParticleIconButton } from "@/components/animate-ui/components/buttons/icon";

// Code
export { Code, CodeHeader, CodeBlock } from "@/components/animate-ui/components/animate/code";
export { CodeTabs } from "@/components/animate-ui/components/animate/code-tabs";

// Pointer
export {
  CursorProvider,
  Cursor,
  CursorFollow,
} from "@/components/animate-ui/components/animate/cursor";
export { GitHubStarsWheel } from "@/components/animate-ui/components/animate/github-stars-wheel";

// Community blocks
export { FlipCard } from "@/components/animate-ui/components/community/flip-card";
export { ManagementBar } from "@/components/animate-ui/components/community/management-bar";
export { MotionCarousel } from "@/components/animate-ui/components/community/motion-carousel";
export { NotificationList } from "@/components/animate-ui/components/community/notification-list";
export { PinList } from "@/components/animate-ui/components/community/pin-list";
export { PlayfulTodolist } from "@/components/animate-ui/components/community/playful-todolist";
export { RadialIntro } from "@/components/animate-ui/components/community/radial-intro";
export { RadialNav } from "@/components/animate-ui/components/community/radial-nav";
export { ShareButton } from "@/components/animate-ui/components/community/share-button";
export { UserPresenceAvatar } from "@/components/animate-ui/components/community/user-presence-avatar";
