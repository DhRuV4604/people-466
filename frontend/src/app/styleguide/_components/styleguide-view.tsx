"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bell,
  Bold,
  Bookmark,
  Box,
  Copy,
  Eye,
  EyeOff,
  FileJson,
  GitCommit,
  Info,
  Italic,
  KeyRound,
  LayoutGrid,
  Mail,
  Pencil,
  Search,
  Share2,
  Trash2,
  Underline,
  User,
} from "lucide-react";

import {
  ActionButton,
  RecordDialog,
  RecordForm,
  RowActions,
} from "@/components/form";
import { DEMO_FIELDS } from "@/app/styleguide/fields";
import { demoApprove, demoDelete, demoSave } from "@/app/styleguide/actions";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AppleIcon,
  AuroraHero,
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupTooltip,
  Badge,
  Button,
  CheckboxField,
  Code,
  CodeBlock,
  CodeHeader,
  CodeTabs,
  ConfirmDialog,
  CopyButton,
  Cursor,
  CursorFollow,
  CursorProvider,
  DatePicker,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldHeader,
  FieldLabel,
  FileItem,
  Files,
  FlipButton,
  FlipButtonBack,
  FlipButtonFront,
  FlipCard,
  FolderContent,
  FolderItem,
  FolderTrigger,
  GoogleIcon,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  IconButton,
  Input,
  InputAddon,
  InputGroup,
  LiquidButton,
  ManagementBar,
  MotionCarousel,
  NotificationList,
  ParticleIconButton,
  PinList,
  PlayfulTodolist,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PreviewLinkCard,
  PreviewLinkCardContent,
  PreviewLinkCardImage,
  PreviewLinkCardTrigger,
  ProfileCard,
  ProfileMenu,
  Progress,
  RadialNav,
  RadioGroup,
  RadioGroupItem,
  Select,
  Separator,
  ShareButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  SubFiles,
  Switch,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemeTogglerButton,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  UserAvatar,
  UserPresenceAvatar,
  useToast,
} from "@/components/ui";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Bell as BellIcon } from "@/components/animate-ui/icons/bell";
import { Check as CheckIcon } from "@/components/animate-ui/icons/check";
import { Clock as ClockIcon } from "@/components/animate-ui/icons/clock";
import { LoaderCircle } from "@/components/animate-ui/icons/loader-circle";
import { LogIn } from "@/components/animate-ui/icons/log-in";
import { Plus as PlusIcon } from "@/components/animate-ui/icons/plus";
import { Search as SearchIcon } from "@/components/animate-ui/icons/search";
import { Settings as SettingsIcon } from "@/components/animate-ui/icons/settings";
import { Trash as TrashIcon } from "@/components/animate-ui/icons/trash";
import { UserRound as UserRoundIcon } from "@/components/animate-ui/icons/user-round";
import { Users } from "@/components/animate-ui/icons/users";

import { Example, Section, Swatch, SwatchGrid, useTokenValues } from "./docs";

const BRAND_TOKENS = ["--primary", "--primary-foreground", "--ring"];
const SURFACE_TOKENS = [
  "--background",
  "--card",
  "--popover",
  "--muted",
  "--accent",
  "--secondary",
];
const TEXT_TOKENS = [
  "--foreground",
  "--muted-foreground",
  "--accent-foreground",
  "--secondary-foreground",
];
const LINE_TOKENS = ["--border", "--input", "--destructive"];
const RADIUS_TOKENS = [
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--radius-2xl",
];
const ALL_TOKENS = [
  ...BRAND_TOKENS,
  ...SURFACE_TOKENS,
  ...TEXT_TOKENS,
  ...LINE_TOKENS,
  ...RADIUS_TOKENS,
  "--radius",
];

const TYPE_SCALE = [
  { cls: "text-4xl", label: "Display", sample: "Welcome back" },
  { cls: "text-3xl", label: "Page title", sample: "Team directory" },
  { cls: "text-2xl", label: "Section", sample: "Pending invites" },
  { cls: "text-xl", label: "Subsection", sample: "Permissions" },
  { cls: "text-lg", label: "Lead", sample: "Everyone in one place" },
  {
    cls: "text-base",
    label: "Body",
    sample: "The quick brown fox jumps over the lazy dog.",
  },
  {
    cls: "text-sm",
    label: "Body small",
    sample: "The quick brown fox jumps over the lazy dog.",
  },
  { cls: "text-xs", label: "Caption", sample: "Updated 2 minutes ago" },
];

const RADII = [
  { cls: "rounded-sm", token: "--radius-sm" },
  { cls: "rounded-md", token: "--radius-md" },
  { cls: "rounded-lg", token: "--radius-lg" },
  { cls: "rounded-xl", token: "--radius-xl" },
  { cls: "rounded-2xl", token: "--radius-2xl" },
];

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16];

const ANIMATED_ICONS = [
  { Icon: BellIcon, name: "bell" },
  { Icon: SearchIcon, name: "search" },
  { Icon: SettingsIcon, name: "settings" },
  { Icon: TrashIcon, name: "trash" },
  { Icon: PlusIcon, name: "plus" },
  { Icon: CheckIcon, name: "check" },
  { Icon: ClockIcon, name: "clock" },
  { Icon: UserRoundIcon, name: "user-round" },
  { Icon: LogIn, name: "log-in" },
  { Icon: Users, name: "users" },
];

const STATIC_ICONS = [
  { Icon: Mail, name: "mail" },
  { Icon: Bell, name: "bell" },
  { Icon: Search, name: "search" },
  { Icon: Pencil, name: "pencil" },
  { Icon: Trash2, name: "trash-2" },
  { Icon: Share2, name: "share-2" },
  { Icon: Copy, name: "copy" },
  { Icon: Info, name: "info" },
  { Icon: Eye, name: "eye" },
  { Icon: ArrowRight, name: "arrow-right" },
];

const TEAM = [
  { name: "Aditi Rao", fallback: "AR" },
  { name: "Marcus Lee", fallback: "ML" },
  { name: "Sofia Almeida", fallback: "SA" },
  { name: "Ben Okafor", fallback: "BO" },
  { name: "Yuki Tanaka", fallback: "YT" },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "guest", label: "Guest", disabled: true },
];

const PIN_ITEMS = [
  {
    id: 1,
    name: "Commit Zone",
    info: "Code updates · Closes 9:00 PM",
    icon: GitCommit,
    pinned: true,
  },
  {
    id: 2,
    name: "404 Room",
    info: "Fixing errors · Open 24 hours",
    icon: AlertTriangle,
    pinned: true,
  },
  {
    id: 3,
    name: "NPM Stop",
    info: "Install stuff · Closes 8:00 PM",
    icon: Box,
    pinned: false,
  },
  {
    id: 4,
    name: "Auth Alley",
    info: "Login help · Open 24 hours",
    icon: KeyRound,
    pinned: false,
  },
];

const RADIAL_ITEMS = [
  { id: 1, icon: LayoutGrid, label: "Projects", angle: 0 },
  { id: 2, icon: Bookmark, label: "Bookmarks", angle: -115 },
  { id: 3, icon: User, label: "About", angle: 115 },
];

// A local placeholder portrait, so the card has a real image without a
// network request and without an empty src.
const PLACEHOLDER_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>" +
      "<rect width='96' height='96' rx='48' fill='#7c3aed'/>" +
      "<text x='48' y='61' font-family='sans-serif' font-size='34' " +
      "font-weight='600' fill='white' text-anchor='middle'>AR</text></svg>",
  );

const FLIP_CARD_DATA = {
  name: "Aditi Rao",
  username: "aditi",
  image: PLACEHOLDER_AVATAR,
  bio: "Runs the platform team. Cares about onboarding, permissions and making the directory feel instant.",
  stats: { following: 182, followers: 1240, posts: 96 },
  socialLinks: {
    linkedin: "https://linkedin.com",
    github: "https://github.com",
    twitter: "https://twitter.com",
  },
};

const CODE_SAMPLE = `import { Button } from "@/components/ui";

export function InviteButton() {
  return (
    <Button endIcon={<ArrowRight />}>
      Invite people
    </Button>
  );
}`;

const CODE_TABS = {
  npm: "npx shadcn@latest add https://animate-ui.com/r/components-radix-tabs.json",
  pnpm: "pnpm dlx shadcn@latest add https://animate-ui.com/r/components-radix-tabs.json",
  bun: "bunx shadcn@latest add https://animate-ui.com/r/components-radix-tabs.json",
};

const NAV: [string, string][] = [
  ["colour", "Colour"],
  ["typography", "Typography"],
  ["layout", "Radius & spacing"],
  ["icons", "Icons"],
  ["buttons", "Buttons"],
  ["expressive", "Expressive buttons"],
  ["forms", "Forms"],
  ["selection", "Selection"],
  ["records", "Records"],
  ["people", "People"],
  ["status", "Status"],
  ["overlays", "Overlays"],
  ["disclosure", "Disclosure"],
  ["navigation", "Navigation"],
  ["feedback", "Feedback"],
  ["code", "Code"],
  ["blocks", "Blocks"],
  ["motion", "Motion"],
  ["artwork", "Artwork"],
];

export function StyleguideView() {
  const tokens = useTokenValues(ALL_TOKENS);
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState("member");
  const [subscribed, setSubscribed] = React.useState(true);
  const [notify, setNotify] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>();
  const [progress, setProgress] = React.useState(64);
  const [plan, setPlan] = React.useState("team");

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
      <header>
        <Link
          href="/login"
          className="inline-flex items-center gap-2.5 font-semibold"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users size={19} />
          </span>
          <span className="text-lg tracking-tight">People</span>
        </Link>

        <h1 className="mt-10 text-4xl font-semibold tracking-tight">
          Styleguide
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Every token and component the product is built from, each shown doing
          the job it exists for. Everything here is live: click it, type in it,
          open it. If a pattern is not on this page, it does not exist yet.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-16 flex flex-col gap-16">
        {/* ── Colour ─────────────────────────────────────────────── */}
        <Section
          id="colour"
          title="Colour"
          description="One accent carries the brand; everything else is neutral. Colours are CSS custom properties, so changing a token updates every component at once. Values are read live from this page."
        >
          <Example
            title="Brand"
            use="The accent and what sits on top of it. Used for the primary action on a screen, links, and focus rings. One accent per screen, never two competing."
            className="block"
          >
            <SwatchGrid>
              {BRAND_TOKENS.map((t) => (
                <Swatch
                  key={t}
                  token={t}
                  value={tokens[t]}
                  border={t.includes("foreground")}
                />
              ))}
            </SwatchGrid>
          </Example>

          <Example
            title="Surfaces"
            use="Backgrounds, from the page itself up through cards, popovers and muted panels. Depth comes from these steps and a border, not from shadows."
            className="block"
          >
            <SwatchGrid>
              {SURFACE_TOKENS.map((t) => (
                <Swatch key={t} token={t} value={tokens[t]} border />
              ))}
            </SwatchGrid>
          </Example>

          <Example
            title="Text"
            use="Foreground for anything the reader must act on, muted for supporting copy. Never drop below muted for body text."
            className="block"
          >
            <SwatchGrid>
              {TEXT_TOKENS.map((t) => (
                <Swatch key={t} token={t} value={tokens[t]} />
              ))}
            </SwatchGrid>
          </Example>

          <Example
            title="Lines and feedback"
            use="Borders separate; destructive warns. Red is reserved for loss and failure, so it keeps its meaning."
            className="block"
          >
            <SwatchGrid>
              {LINE_TOKENS.map((t) => (
                <Swatch key={t} token={t} value={tokens[t]} border />
              ))}
            </SwatchGrid>
          </Example>
        </Section>

        {/* ── Typography ─────────────────────────────────────────── */}
        <Section
          id="typography"
          title="Typography"
          description="Geist throughout, Geist Mono for code and token values. Headings are semibold with tight tracking; body copy stays regular."
        >
          <Example title="Scale" className="block p-0">
            <div className="w-full divide-y divide-border">
              {TYPE_SCALE.map((row) => (
                <div
                  key={row.cls}
                  className="flex flex-col gap-2 p-5 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <div className="w-36 shrink-0">
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.cls}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                  </div>
                  <p
                    className={`${row.cls} min-w-0 truncate font-semibold tracking-tight`}
                  >
                    {row.sample}
                  </p>
                </div>
              ))}
            </div>
          </Example>

          <Example
            title="Weights"
            use="Regular for reading, medium for anything clickable or labelled, semibold for headings. Three weights is the whole system."
            className="block"
          >
            <div className="flex flex-col gap-1 text-lg">
              <p className="font-normal">Regular, for body copy</p>
              <p className="font-medium">Medium, for labels and buttons</p>
              <p className="font-semibold">Semibold, for headings</p>
            </div>
          </Example>
        </Section>

        {/* ── Radius & spacing ───────────────────────────────────── */}
        <Section
          id="layout"
          title="Radius and spacing"
          description={`Radius derives from a single --radius token (${tokens["--radius"] || "…"}), so corners stay in proportion. Spacing follows the 4px step.`}
        >
          <Example title="Radius" className="block">
            <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-5">
              {RADII.map((r) => (
                <div key={r.cls} className="flex flex-col gap-2">
                  <div
                    className={`h-16 border border-border bg-background ${r.cls}`}
                  />
                  <p className="font-mono text-xs">{r.cls}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {tokens[r.token] || "—"}
                  </p>
                </div>
              ))}
            </div>
          </Example>

          <Example
            title="Spacing"
            use="Gaps, padding and margins all draw from this step, which is what keeps rhythm consistent between unrelated screens."
            className="block"
          >
            <div className="flex w-full flex-col gap-2">
              {SPACING.map((step) => (
                <div key={step} className="flex items-center gap-4">
                  <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                    {step}
                  </span>
                  <span
                    className="h-3 rounded-sm bg-primary/70"
                    style={{ width: `calc(var(--spacing) * ${step})` }}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {step * 4}px
                  </span>
                </div>
              ))}
            </div>
          </Example>
        </Section>

        {/* ── Icons ──────────────────────────────────────────────── */}
        <Section
          id="icons"
          title="Icons"
          description="Two sets, one visual language. Animated icons draw attention at a moment of change; static Lucide icons label everything else. Size follows the control, and an icon never appears without a label or an accessible name."
        >
          <Example
            title="Animated"
            use="Hover any of these. Use them where an icon marks a transition: submitting, deleting, completing, opening settings."
            className="block"
          >
            <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-5">
              {ANIMATED_ICONS.map(({ Icon, name }) => (
                <AnimateIcon key={name} animateOnHover>
                  <div className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted">
                    <Icon size={22} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {name}
                    </span>
                  </div>
                </AnimateIcon>
              ))}
            </div>
          </Example>

          <Example
            title="Static"
            use="The default. Any Lucide icon works; these are the ones already in use."
            className="block"
          >
            <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-5">
              {STATIC_ICONS.map(({ Icon, name }) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-4"
                >
                  <Icon className="size-[22px]" />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </Example>
        </Section>

        {/* ── Buttons ────────────────────────────────────────────── */}
        <Section
          id="buttons"
          title="Buttons"
          description="One component behind every button in the product. Icons are passed as startIcon or endIcon rather than as children, which keeps them on the flex baseline at every size."
        >
          <Example
            title="Variants"
            use="One primary per screen: the thing you want done. Outline for the alternative, ghost for low-stakes actions in dense rows, destructive only for loss, link for navigation inside a sentence."
          >
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
          </Example>

          <Example
            title="Sizes"
            use="Large for a form's main submit, medium everywhere else, small inside toolbars and table rows."
          >
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Example>

          <Example
            title="With icons"
            use="A leading icon labels the action; a trailing icon points at what happens next. Never both on one button."
          >
            <Button endIcon={<LogIn />}>Log in</Button>
            <Button variant="outline" startIcon={<GoogleIcon />}>
              Google
            </Button>
            <Button variant="outline" startIcon={<AppleIcon />}>
              Apple
            </Button>
            <Button variant="ghost" endIcon={<ArrowRight />}>
              Continue
            </Button>
          </Example>

          <Example
            title="Loading and disabled"
            use="Loading keeps the button in place and swaps the label, so the layout never jumps. Disabled is for a state the user can fix; if they cannot fix it, remove the button instead."
          >
            <Button
              loading={loading}
              loadingText="Signing in"
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1800);
              }}
            >
              Click to load
            </Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled startIcon={<GoogleIcon />}>
              Disabled outline
            </Button>
          </Example>

          <Example
            title="Icon buttons"
            use="Only where the icon is unambiguous and space is tight. The label prop is required and becomes the accessible name plus the tooltip."
          >
            <IconButton label="Search" icon={<Search />} />
            <IconButton size="sm" label="Search" icon={<Search />} />
            <IconButton variant="outline" label="Edit" icon={<Pencil />} />
            <IconButton variant="primary" label="Add" icon={<PlusIcon />} />
            <IconButton
              variant="destructive"
              label="Delete"
              icon={<Trash2 />}
            />
          </Example>
        </Section>

        {/* ── Expressive buttons ─────────────────────────────────── */}
        <Section
          id="expressive"
          title="Expressive buttons"
          description="Buttons whose whole point is the motion. At most one of these per screen, and never inside a form or a table: they compete with the primary action rather than supporting it."
        >
          <Example
            title="Copy"
            use="Anywhere a value needs to travel: an invite link, an API key, a workspace ID. The tick is the receipt, so no toast is needed."
          >
            <CopyButton content="people.app/invite/8f2c1a" />
            <CopyButton variant="default" content="Copied from the styleguide" />
            <span className="text-xs text-muted-foreground">
              Click to copy
            </span>
          </Example>

          <Example
            title="Flip"
            use="For a single call to action on a marketing surface, where the flip reveals the payoff. Not for repeated actions."
          >
            <FlipButton>
              <FlipButtonFront>Get started</FlipButtonFront>
              <FlipButtonBack>It is free</FlipButtonBack>
            </FlipButton>
          </Example>

          <Example
            title="Liquid"
            use="A hero button. The fill follows the pointer, so it rewards a deliberate hover rather than a passing one."
          >
            <LiquidButton>Hover me</LiquidButton>
          </Example>

          <Example
            title="Particle icon"
            use="An icon button that bursts on click. Good for a satisfying, repeatable action such as adding or starring."
          >
            <ParticleIconButton>
              <PlusIcon />
            </ParticleIconButton>
            <ParticleIconButton variant="outline">
              <BellIcon />
            </ParticleIconButton>
          </Example>

          <Example
            title="Share"
            use="Expands into its destinations instead of opening a menu, which saves a click when there are only a few."
          >
            <ShareButton>Share</ShareButton>
          </Example>

          <Example
            title="Theme toggler"
            use="Cycles light, dark and system. It needs a theme provider mounted at the app root to actually switch, which this project has not added yet."
          >
            <ThemeTogglerButton />
          </Example>
        </Section>

        {/* ── Forms ──────────────────────────────────────────────── */}
        <Section
          id="forms"
          title="Forms"
          description="An input is composed, not stacked. InputGroup owns the border, height and focus ring; addons are flex children, so a trailing control can never drift out of the field. Every control here shares that same shell, so a select and a text field are the same height and radius."
        >
          <Example
            title="Text field"
            use="The default. Label above, field below, error underneath. The error animates its own height so the rows around it never jump."
            className="block"
          >
            <div className="w-full max-w-sm">
              <Field>
                <FieldLabel htmlFor="sg-email">Email</FieldLabel>
                <InputGroup>
                  <Input
                    id="sg-email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </InputGroup>
              </Field>
            </div>
          </Example>

          <Example
            title="Addons"
            use="A leading icon classifies the field at a glance; a trailing control acts on its contents, like revealing a password."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <InputGroup>
                <InputAddon>
                  <Mail />
                </InputAddon>
                <Input placeholder="you@company.com" />
              </InputGroup>

              <InputGroup>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <InputAddon side="end">
                  <IconButton
                    size="sm"
                    label={showPassword ? "Hide password" : "Show password"}
                    icon={showPassword ? <EyeOff /> : <Eye />}
                    onClick={() => setShowPassword((v) => !v)}
                  />
                </InputAddon>
              </InputGroup>
            </div>
          </Example>

          <Example
            title="Sizes and states"
            use="Large for primary forms like sign-in, medium inside dense settings panels. Invalid turns the border and ring red and pairs with a message that says how to fix it."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <InputGroup size="md">
                <Input placeholder="Medium, 44px" />
              </InputGroup>
              <InputGroup size="lg">
                <Input placeholder="Large, 48px" />
              </InputGroup>
              <Field>
                <InputGroup invalid>
                  <Input placeholder="Invalid" aria-invalid />
                </InputGroup>
                <FieldError message="That doesn't look like a valid email address." />
              </Field>
              <InputGroup>
                <Input placeholder="Disabled" disabled />
              </InputGroup>
            </div>
          </Example>

          <Example
            title="Label with an action"
            use="When a field needs an escape hatch, put it on the label row rather than below the input, where it competes with errors."
            className="block"
          >
            <div className="w-full max-w-sm">
              <Field>
                <FieldHeader>
                  <FieldLabel htmlFor="sg-pw">Password</FieldLabel>
                  <Link
                    href="#"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </FieldHeader>
                <InputGroup>
                  <Input id="sg-pw" type="password" placeholder="••••••••" />
                </InputGroup>
              </Field>
            </div>
          </Example>

          <Example
            title="Select"
            use="For a known, short list where only one option applies. It opens the animated menu rather than a native popup, so it matches every other overlay, and the menu takes the trigger's width."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="sg-role">Role</FieldLabel>
                <Select
                  id="sg-role"
                  options={ROLE_OPTIONS}
                  value={role}
                  onValueChange={setRole}
                />
              </Field>
              <Select
                options={ROLE_OPTIONS}
                placeholder="Nothing chosen yet"
              />
            </div>
          </Example>

          <Example
            title="Date picker"
            use="A date is a button that opens a calendar, never a text box: it removes every parsing and format question. The popover closes as soon as a day is chosen."
            className="block"
          >
            <div className="w-full max-w-sm">
              <Field>
                <FieldLabel htmlFor="sg-date">Start date</FieldLabel>
                <DatePicker id="sg-date" value={date} onChange={setDate} />
              </Field>
            </div>
          </Example>

          <Example
            title="Textarea"
            use="For free text longer than a line: a note, a reason, an invite message."
            className="block"
          >
            <div className="w-full max-w-sm">
              <Field>
                <FieldLabel htmlFor="sg-note">Note</FieldLabel>
                <Textarea
                  id="sg-note"
                  rows={4}
                  placeholder="Add context for the rest of the team…"
                />
              </Field>
            </div>
          </Example>
        </Section>

        {/* ── Selection ──────────────────────────────────────────── */}
        <Section
          id="selection"
          title="Selection and toggles"
          description="A checkbox and a radio collect an answer the form will submit. A switch and a toggle change something the moment they move. Choosing the wrong one is the most common source of confusion in settings screens."
        >
          <Example
            title="Checkbox"
            use="Part of a form, applied on submit. Pairs with a clickable label so the whole row is a target."
            className="block"
          >
            <div className="flex flex-col gap-3">
              <CheckboxField
                id="sg-updates"
                checked={subscribed}
                onCheckedChange={(v) => setSubscribed(v === true)}
              >
                Email me product updates
              </CheckboxField>
              <CheckboxField id="sg-disabled" disabled>
                Disabled option
              </CheckboxField>
            </div>
          </Example>

          <Example
            title="Radio group"
            use="One choice from a short set where seeing all the options matters. If the list is long or the options are self-evident, use a select instead."
            className="block"
          >
            <RadioGroup value={plan} onValueChange={setPlan} className="gap-3">
              {[
                { value: "solo", label: "Solo", hint: "Just you" },
                { value: "team", label: "Team", hint: "Up to 30 people" },
                { value: "org", label: "Organisation", hint: "Unlimited" },
              ].map((option) => (
                <label
                  key={option.value}
                  htmlFor={`plan-${option.value}`}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <RadioGroupItem
                    id={`plan-${option.value}`}
                    value={option.value}
                  />
                  <span>
                    {option.label}
                    <span className="block text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </Example>

          <Example
            title="Switch"
            use="Takes effect immediately, with no save button in sight. If the change needs confirming, it is a checkbox."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <label className="flex cursor-pointer items-center justify-between gap-6 text-sm">
                <span>
                  Notifications
                  <span className="block text-xs text-muted-foreground">
                    Applies as soon as you toggle it
                  </span>
                </span>
                <Switch checked={notify} onCheckedChange={setNotify} />
              </label>
              <Separator />
              <label className="flex items-center justify-between gap-6 text-sm text-muted-foreground">
                <span>Disabled</span>
                <Switch disabled />
              </label>
            </div>
          </Example>

          <Example
            title="Toggle and toggle group"
            use="A pressed state on a control, for formatting and view switches. A group makes the options mutually exclusive."
          >
            <Toggle aria-label="Bold">
              <Bold />
            </Toggle>
            <Toggle aria-label="Italic">
              <Italic />
            </Toggle>
            <Toggle aria-label="Underline">
              <Underline />
            </Toggle>
            <Separator orientation="vertical" className="mx-2 h-8" />
            <ToggleGroup type="single" defaultValue="left">
              <ToggleGroupItem value="left" aria-label="Align left">
                <AlignLeft />
              </ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="Align centre">
                <AlignCenter />
              </ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Align right">
                <AlignRight />
              </ToggleGroupItem>
            </ToggleGroup>
          </Example>
        </Section>

        {/* ── Records ────────────────────────────────────────────── */}
        <Section
          id="records"
          title="Records"
          description="Everything that writes. A screen declares its fields once as plain data, points at its server action, and these four components handle the rest: layout, the busy state, where each message lands, and the confirmation afterwards. Adding a column to a record is one line, not an edit in three files."
        >
          <Example
            title="Record form"
            use="The whole form from a field list. Submit it empty to see where the messages land, then fill it in: the fields keep their spacing whether a message is showing or not."
            className="block"
          >
            <div className="w-full max-w-2xl">
              <RecordForm
                fields={DEMO_FIELDS}
                action={demoSave}
                submitLabel="Save"
              />
            </div>
          </Example>

          <Example
            title="Record dialog"
            use="The same form in an overlay. Create and edit are one component: passing a record switches it to an update and prefills every control. It closes on success and stays open, with the messages in place, when the server refuses."
          >
            <RecordDialog
              title="New teammate"
              description="Nothing here is stored. It runs the real validation and returns."
              fields={DEMO_FIELDS}
              action={demoSave}
              submitLabel="Add teammate"
            />
            <RecordDialog
              title="Edit teammate"
              description="The same dialog, given a record."
              fields={DEMO_FIELDS}
              action={demoSave}
              record={{
                id: "demo",
                name: "Priya Patel",
                email: "priya.patel@company.com",
                role: "admin",
                startDate: "2024-06-01",
                salary: 85000,
                active: true,
                notes: "Joined from the Bengaluru office.",
              }}
              trigger={
                <Button variant="outline" size="sm" startIcon={<Pencil />}>
                  Edit teammate
                </Button>
              }
            />
          </Example>

          <Example
            title="Row actions"
            use="The per-row menu. It sits in the same place on every list, so edit and delete are always where the user last left them. Delete confirms, and the confirmation names the consequence rather than asking whether the user is sure."
          >
            <div className="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3">
              <span className="text-sm">Priya Patel</span>
              <RowActions
                edit={{
                  title: "Edit teammate",
                  fields: DEMO_FIELDS,
                  action: demoSave,
                  record: { id: "demo", name: "Priya Patel", role: "admin" },
                }}
                remove={{
                  action: demoDelete,
                  title: "Remove Priya Patel?",
                  description:
                    "This removes the teammate and everything filed under them. It cannot be undone.",
                }}
              />
            </div>
          </Example>

          <Example
            title="Action button"
            use="For a verb the server owns rather than a record edit: approve, compute, mark paid. It disables itself while the request is in flight and reports the outcome, so a change that only moves a badge is still acknowledged."
          >
            <ActionButton action={demoApprove} size="sm">
              Approve
            </ActionButton>
            <ActionButton
              action={demoDelete}
              variant="destructive"
              size="sm"
              confirm={{
                title: "Cancel this pay run?",
                description:
                  "The pay run and every payslip in it are removed. It cannot be undone.",
                confirmLabel: "Cancel pay run",
                destructive: true,
              }}
            >
              Cancel pay run
            </ActionButton>
          </Example>

          <Example
            title="Toast"
            use="Confirmation for anything that leaves no visible trace on the page. Anything that already shows its own result does not need one, so this is the exception rather than the habit."
          >
            <Button size="sm" variant="outline" onClick={() => toast("Employee created.")}>
              Show a confirmation
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast("That employee could not be removed.", "error")}
            >
              Show a failure
            </Button>
          </Example>
        </Section>

        {/* ── People ─────────────────────────────────────────────── */}
        <Section
          id="people"
          title="People and profile"
          description="This product is about people, so identity shows up everywhere. Photos fall back to initials, never to a generic silhouette, so rows stay distinguishable even without images."
        >
          <Example
            title="Avatar"
            use="Sizes map to context: small in table rows, medium in menus and lists, large on a profile header."
          >
            <UserAvatar name="Aditi Rao" size="sm" />
            <UserAvatar name="Marcus Lee" size="md" />
            <UserAvatar name="Sofia Almeida" size="lg" />
          </Example>

          <Example
            title="Avatar group"
            use="Who is on a thing, without listing them. Hover a face for the name."
          >
            <AvatarGroup>
              {TEAM.map((person) => (
                <Avatar
                  key={person.name}
                  className="size-12 border-3 border-background"
                >
                  <AvatarFallback>{person.fallback}</AvatarFallback>
                  <AvatarGroupTooltip>{person.name}</AvatarGroupTooltip>
                </Avatar>
              ))}
            </AvatarGroup>
          </Example>

          <Example
            title="Presence"
            use="Who is here right now, on a live document or board. Presence is about this moment, so it belongs near the content, not in a sidebar."
            className="block"
          >
            <UserPresenceAvatar />
          </Example>

          <Example
            title="Profile card"
            use="The identity block for lists, mention results and menu headers: name first, everything else secondary."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <ProfileCard
                name="Aditi Rao"
                email="aditi@people.app"
                role="Admin"
              />
              <Separator />
              <ProfileCard name="Marcus Lee" email="marcus@people.app" />
            </div>
          </Example>

          <Example
            title="Profile menu"
            use="The avatar in an app header. Opens the account menu, with the signed-in identity repeated at the top so there is no doubt whose account is about to change."
          >
            <ProfileMenu name="Aditi Rao" email="aditi@people.app" role="Admin" />
            <span className="text-xs text-muted-foreground">
              Click the avatar
            </span>
          </Example>

          <Example
            title="Profile card, expanded"
            use="A richer identity surface for a directory or an about page, where the back holds the links."
            className="block"
          >
            <FlipCard data={FLIP_CARD_DATA} />
          </Example>
        </Section>

        {/* ── Status ─────────────────────────────────────────────── */}
        <Section
          id="status"
          title="Status"
          description="Badges carry state, not decoration. Keep the vocabulary small and the meaning fixed, so a colour can be read without its label."
        >
          <Example
            title="Badge"
            use="A short noun describing what something is or where it stands. Never a sentence, never a button."
          >
            <Badge>Active</Badge>
            <Badge variant="secondary">Member</Badge>
            <Badge variant="outline">Invited</Badge>
            <Badge variant="destructive">Suspended</Badge>
            <Badge variant="ghost">Archived</Badge>
          </Example>

          <Example
            title="In a row"
            use="Where badges usually live: at the end of a person row, carrying the one fact that changes how you read the rest."
            className="block"
          >
            <div className="flex w-full max-w-md flex-col divide-y divide-border rounded-lg border border-border bg-background">
              {[
                {
                  name: "Aditi Rao",
                  email: "aditi@people.app",
                  badge: "Admin",
                  variant: "secondary" as const,
                },
                {
                  name: "Marcus Lee",
                  email: "marcus@people.app",
                  badge: "Active",
                  variant: "default" as const,
                },
                {
                  name: "Sofia Almeida",
                  email: "sofia@people.app",
                  badge: "Invited",
                  variant: "outline" as const,
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <ProfileCard name={row.name} email={row.email} />
                  <Badge variant={row.variant}>{row.badge}</Badge>
                </div>
              ))}
            </div>
          </Example>
        </Section>

        {/* ── Overlays ───────────────────────────────────────────── */}
        <Section
          id="overlays"
          title="Overlays"
          description="Several surfaces, each with one job. Reaching for the wrong one is what makes an interface feel heavy: a tooltip that should have been a popover, or a modal that should have been neither."
        >
          <Example
            title="Tooltip"
            use="Names a control that has no visible label. It can never hold anything the user has to act on, because it disappears the moment they move."
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton label="Notifications" icon={<Bell />} />
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Short, factual, no actions</TooltipContent>
            </Tooltip>
          </Example>

          <Example
            title="Hover card"
            use="A preview on hover, for a person or an object referenced in passing. Richer than a tooltip, still not something to click through."
          >
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="link">@aditi</Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-72">
                <ProfileCard
                  name="Aditi Rao"
                  email="aditi@people.app"
                  role="Admin"
                />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Runs the platform team. Joined in March 2024.
                </p>
              </HoverCardContent>
            </HoverCard>
          </Example>

          <Example
            title="Link preview"
            use="Shows where a link goes before the user commits to leaving. Use it in documentation and long-form copy, not in navigation."
            className="block"
          >
            <p className="text-sm text-muted-foreground">
              Components come from the{" "}
              <PreviewLinkCard href="https://animate-ui.com">
                <PreviewLinkCardTrigger
                  target="_blank"
                  className="text-foreground underline"
                >
                  Animate UI docs
                </PreviewLinkCardTrigger>
                <PreviewLinkCardContent>
                  <PreviewLinkCardImage />
                </PreviewLinkCardContent>
              </PreviewLinkCard>
              , installed through the shadcn CLI.
            </p>
          </Example>

          <Example
            title="Popover"
            use="A small surface anchored to what opened it, for a detail or a quick edit. The page stays live behind it, so use it when the user is still working in context."
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" startIcon={<Info />}>
                  Open popover
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <p className="text-sm font-medium">Seat usage</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You are using 24 of 30 seats. Invites that exceed the limit
                  will wait until a seat frees up.
                </p>
                <Progress value={80} className="mt-4" />
              </PopoverContent>
            </Popover>
          </Example>

          <Example
            title="Dropdown menu"
            use="A list of actions on one object. Group related items, put the destructive one last and behind a separator so it is never the accidental click."
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Aditi Rao</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Pencil />
                  Edit profile
                  <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Trash2 />
                  Remove from team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Example>

          <Example
            title="Sheet"
            use="A side panel for a task that needs room but not the whole screen: filters, details, a longer form. The page stays visible behind it, which keeps context."
          >
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open panel</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Member details</SheetTitle>
                  <SheetDescription>
                    Everything about this person, without leaving the directory.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-5 p-4">
                  <ProfileCard
                    name="Aditi Rao"
                    email="aditi@people.app"
                    role="Admin"
                  />
                  <Field>
                    <FieldLabel htmlFor="sg-sheet-role">Role</FieldLabel>
                    <Select
                      id="sg-sheet-role"
                      options={ROLE_OPTIONS}
                      defaultValue="admin"
                    />
                  </Field>
                </div>
              </SheetContent>
            </Sheet>
          </Example>

          <Example
            title="Modal"
            use="Takes the whole screen's attention for a task that needs finishing before anything else. It has its own title, its own actions, and a way out that is not the primary button."
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button startIcon={<PlusIcon />}>Invite people</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite people</DialogTitle>
                  <DialogDescription>
                    They will get an email with a link to join your workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <Field>
                    <FieldLabel htmlFor="sg-invite">Email</FieldLabel>
                    <InputGroup>
                      <InputAddon>
                        <Mail />
                      </InputAddon>
                      <Input id="sg-invite" placeholder="teammate@company.com" />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sg-invite-role">Role</FieldLabel>
                    <Select
                      id="sg-invite-role"
                      options={ROLE_OPTIONS}
                      defaultValue="member"
                    />
                  </Field>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Send invite</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Example>

          <Example
            title="Confirmation"
            use="A checkpoint before something irreversible. The confirm button names the consequence, so 'Remove member' rather than 'OK', and the cancel is the calmer of the two."
          >
            <ConfirmDialog
              trigger={
                <Button variant="destructive" startIcon={<Trash2 />}>
                  Remove member
                </Button>
              }
              title="Remove Aditi Rao?"
              description="They lose access to this workspace immediately. Anything they created stays, and you can invite them again later."
              confirmLabel="Remove member"
              cancelLabel="Keep member"
              destructive
            />
            <ConfirmDialog
              trigger={<Button variant="outline">Publish changes</Button>}
              title="Publish these changes?"
              description="Everyone in the workspace will see the new directory the next time they load it."
              confirmLabel="Publish"
            />
          </Example>
        </Section>

        {/* ── Disclosure ─────────────────────────────────────────── */}
        <Section
          id="disclosure"
          title="Disclosure"
          description="Hiding detail until it is asked for. Only use it when the hidden content is genuinely secondary; a form the user must complete should never be behind a click."
        >
          <Example
            title="Accordion"
            use="Long-form answers, settings groups, anything read one section at a time."
            className="block"
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="roles">
                <AccordionTrigger>What can each role do?</AccordionTrigger>
                <AccordionContent>
                  Owners manage billing and can delete the workspace. Admins
                  manage people and settings. Members see the directory and
                  edit their own profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="invites">
                <AccordionTrigger>How long do invites last?</AccordionTrigger>
                <AccordionContent>
                  Seven days. After that the link expires and you can send a
                  new one from the member row.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="seats">
                <AccordionTrigger>What happens at the seat limit?</AccordionTrigger>
                <AccordionContent>
                  New invites queue rather than fail. They are sent as soon as
                  a seat frees up.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Example>

          <Example
            title="File tree"
            use="Nested structure the user browses rather than reads: a repository, an export, an attachment bundle."
            className="block"
          >
            <div className="max-h-[320px] w-full overflow-auto rounded-lg border border-border bg-background">
              <Files className="w-full" defaultOpen={["app"]}>
                <FolderItem value="app">
                  <FolderTrigger gitStatus="modified">app</FolderTrigger>
                  <FolderContent>
                    <SubFiles defaultOpen={["login"]}>
                      <FolderItem value="login">
                        <FolderTrigger gitStatus="untracked">
                          login
                        </FolderTrigger>
                        <FolderContent>
                          <FileItem gitStatus="untracked">page.tsx</FileItem>
                        </FolderContent>
                      </FolderItem>
                      <FileItem>layout.tsx</FileItem>
                      <FileItem gitStatus="modified">globals.css</FileItem>
                    </SubFiles>
                  </FolderContent>
                </FolderItem>
                <FolderItem value="components">
                  <FolderTrigger>components</FolderTrigger>
                  <FolderContent>
                    <SubFiles>
                      <FileItem>button.tsx</FileItem>
                      <FileItem>input.tsx</FileItem>
                    </SubFiles>
                  </FolderContent>
                </FolderItem>
                <FileItem icon={FileJson}>package.json</FileItem>
              </Files>
            </div>
          </Example>
        </Section>

        {/* ── Navigation ─────────────────────────────────────────── */}
        <Section
          id="navigation"
          title="Navigation"
          description="Tabs split one screen's content into peers. If the sections are not peers, or the user needs two at once, they are not tabs."
        >
          <Example title="Tabs" className="block">
            <Tabs defaultValue="members" className="w-full">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invites">Invites</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContents className="mt-4">
                <TabsContent value="members">
                  <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-5">
                    <ProfileCard
                      name="Aditi Rao"
                      email="aditi@people.app"
                      role="Admin"
                    />
                    <ProfileCard name="Marcus Lee" email="marcus@people.app" />
                  </div>
                </TabsContent>
                <TabsContent value="invites">
                  <div className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
                    Two invites are waiting to be accepted.
                  </div>
                </TabsContent>
                <TabsContent value="settings">
                  <div className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
                    Workspace name, domain and default role live here.
                  </div>
                </TabsContent>
              </TabsContents>
            </Tabs>
          </Example>

          <Example
            title="Radial navigation"
            use="A compact launcher for a handful of destinations. Best on a focused surface such as a dashboard corner, not as primary site navigation."
            className="block justify-center p-10"
          >
            <div className="flex w-full justify-center">
              <RadialNav items={RADIAL_ITEMS} defaultActiveId={1} />
            </div>
          </Example>
        </Section>

        {/* ── Feedback ───────────────────────────────────────────── */}
        <Section
          id="feedback"
          title="Feedback"
          description="Tell the user where things stand. Progress for work that finishes, skeletons for work that is arriving, and a spinner only when neither is knowable."
        >
          <Example
            title="Progress"
            use="For a task with a known end: an upload, an import, seats used against a limit."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              <Progress value={progress} />
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress((p) => Math.max(0, p - 20))}
                >
                  Less
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress((p) => Math.min(100, p + 20))}
                >
                  More
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  {progress}%
                </span>
              </div>
            </div>
          </Example>

          <Example
            title="Skeleton"
            use="Hold the shape of what is loading so the page does not reflow when it arrives. Match the real layout, do not use a generic grey block."
            className="block"
          >
            <div className="flex w-full max-w-sm flex-col gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </Example>

          <Example
            title="Spinner"
            use="Only when there is no measurable progress and no known shape, such as a submit waiting on a server."
          >
            <AnimateIcon animate loop>
              <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-background">
                <LoaderCircle size={22} />
              </span>
            </AnimateIcon>
            <Button loading loadingText="Saving">
              Save
            </Button>
          </Example>

          <Example
            title="Notifications"
            use="A stack of things that happened. Newest on top, each dismissable, and never more than the user can act on."
            className="block"
          >
            <NotificationList />
          </Example>
        </Section>

        {/* ── Code ───────────────────────────────────────────────── */}
        <Section
          id="code"
          title="Code"
          description="For documentation surfaces and setup instructions. Both blocks are read-only and copyable."
        >
          <Example
            title="Code block"
            use="A single snippet, typed out on first view. Use it where the code is the point, such as onboarding docs."
            className="block"
          >
            <Code code={CODE_SAMPLE} className="w-full">
              <CodeHeader copyButton>InviteButton.tsx</CodeHeader>
              <CodeBlock lang="tsx" />
            </Code>
          </Example>

          <Example
            title="Code tabs"
            use="The same command for several package managers, so nobody has to translate it themselves."
            className="block"
          >
            <CodeTabs lang="bash" codes={CODE_TABS} className="w-full" />
          </Example>
        </Section>

        {/* ── Blocks ─────────────────────────────────────────────── */}
        <Section
          id="blocks"
          title="Blocks"
          description="Larger composed pieces. They are opinionated and animation-heavy, so treat them as starting points for a screen rather than as neutral building blocks."
        >
          <Example
            title="Management bar"
            use="A floating action bar for a selection or a canvas: the controls follow the work instead of sitting in a distant header."
            className="block justify-center p-10"
          >
            <div className="flex w-full justify-center">
              <ManagementBar />
            </div>
          </Example>

          <Example
            title="Pin list"
            use="A list split into pinned and unpinned, where items animate between the two. Good for favourites and saved views."
            className="block"
          >
            <PinList items={PIN_ITEMS} labels={{ pinned: "Pinned", unpinned: "Everything else" }} />
          </Example>

          <Example
            title="Todo list"
            use="A checklist where completion is the reward. Use it for onboarding steps and setup checklists."
            className="block"
          >
            <PlayfulTodolist />
          </Example>

          <Example
            title="Carousel"
            use="For a small set of equal items browsed in sequence. Not for navigation, and never for content the user must not miss."
            className="block p-0"
          >
            <div className="w-full overflow-hidden p-6">
              <MotionCarousel slides={[0, 1, 2, 3, 4, 5]} options={{ loop: true }} />
            </div>
          </Example>

          <Example
            title="Custom cursor"
            use="A labelled pointer for a canvas or a collaborative surface, where knowing who is pointing at what matters. Move your pointer inside the panel."
            className="block p-0"
          >
            <div className="relative flex h-64 w-full items-center justify-center rounded-xl bg-accent">
              <p className="text-sm text-muted-foreground italic">
                Move your pointer over this panel
              </p>
              <CursorProvider>
                <Cursor />
                <CursorFollow side="bottom" sideOffset={15} align="end">
                  Aditi
                </CursorFollow>
              </CursorProvider>
            </div>
          </Example>
        </Section>

        {/* ── Motion ─────────────────────────────────────────────── */}
        <Section
          id="motion"
          title="Motion"
          description="Motion is a layer, not a component. Wrap anything to bring it in, and stagger a group by increasing the delay. Everything here respects reduced-motion settings."
        >
          <Example
            title="Entrances"
            use="Use on first paint of a screen or when new content appears. Stagger by 60 to 120ms; past that it reads as slow rather than considered."
          >
            <Fade delay={100}>
              <div className="rounded-lg border border-border bg-background px-5 py-4 text-sm">
                Fade
              </div>
            </Fade>
            <Slide direction="up" offset={20} delay={220}>
              <div className="rounded-lg border border-border bg-background px-5 py-4 text-sm">
                Slide up
              </div>
            </Slide>
            <Slide direction="right" offset={20} delay={340}>
              <div className="rounded-lg border border-border bg-background px-5 py-4 text-sm">
                Slide right
              </div>
            </Slide>
          </Example>
        </Section>

        {/* ── Artwork ────────────────────────────────────────────── */}
        <Section
          id="artwork"
          title="Artwork"
          description="The aurora panel is decoration and nothing else. It is hidden below the lg breakpoint, carries no content that matters, and stops animating under reduced-motion."
        >
          <Example title="Aurora panel" className="block p-0">
            <div className="h-80 w-full overflow-hidden">
              <AuroraHero title="People" />
            </div>
          </Example>
        </Section>
      </div>

      <footer className="mt-20 border-t border-border pt-8 text-xs text-muted-foreground">
        <p>
          Built from{" "}
          <span className="font-mono text-foreground">src/components/ui</span>.
          See it in use on the{" "}
          <Link href="/login" className="text-primary hover:underline">
            login screen
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
